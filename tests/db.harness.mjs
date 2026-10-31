import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = fileURLToPath(new URL("../supabase", import.meta.url));
const read = (p) => fs.readFileSync(`${root}/${p}`, "utf8");
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("HARNESS ERROR:", e.message, e.where ?? ""); process.exit(3); });
process.on("unhandledRejection", (e) => { console.log("HARNESS ERROR:", e.message, e.where ?? ""); process.exit(3); });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  (ok ? pass++ : fail++);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
};

// ---- Supabase-like environment ------------------------------------------------------------
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT anon, authenticated, service_role TO CURRENT_USER;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  -- minimal Supabase Storage stand-in (real Storage has the same RLS-on-storage.objects model)
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets (id), name text, owner uuid);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  GRANT ALL ON storage.objects TO anon, authenticated, service_role;
  GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
`);

// legacy state: original schema.sql (with its insecure policies/functions) then our migrations
await db.exec(read("schema.sql"));
await db.exec(`
  INSERT INTO categories (id,name,name_bn,slug) VALUES ('cat1','Fish','মাছ','fish');
  INSERT INTO products (id,category_id,title,title_bn,slug,short_description,description,primary_image,is_preorder,batch_target_qty,batch_booked_qty,cutting_options)
   VALUES ('p-fish','cat1','Rui','রুই','rui','s','d','/i.png',false,50,0,'["Whole","Curry Cut"]'),
          ('p-doi','cat1','Doi','দই','doi','s','d','/i.png',true,10,8,'[]');
  INSERT INTO product_variants (id,product_id,label,price,stock_qty) VALUES
   ('v-fish-1','p-fish','1kg',500,5), ('v-doi-1','p-doi','1kg',300,100);
  INSERT INTO coupons (id,code,title,discount_type,discount_value,min_order_amount)
   VALUES ('c1','SAVE10','10%','percentage',10,100);
  UPDATE site_settings SET inside_dhaka_fee=70, outside_dhaka_fee=130, free_delivery_threshold=3000, preorder_advance_percent=25;
`);
for (const f of ["01_foundation", "02_orders", "03_payments", "04_admin_ops", "05_rls_lockdown", "06_hero_cms", "07_preorder_settings"]) {
  const file = fs.readdirSync(`${root}/migrations`).find((n) => n.includes(f));
  try { await db.exec(read(`migrations/${file}`)); console.log(`applied ${file}`); }
  catch (e) { console.log(`MIGRATION FAILED ${file}: ${e.message}`); process.exit(2); }
}
await db.exec("UPDATE coupons SET max_uses = 2 WHERE id = 'c1'");
// idempotency: re-running every migration must succeed too
for (const f of ["01_foundation", "02_orders", "03_payments", "04_admin_ops", "05_rls_lockdown", "06_hero_cms", "07_preorder_settings"]) {
  const file = fs.readdirSync(`${root}/migrations`).find((n) => n.includes(f));
  try { await db.exec(read(`migrations/${file}`)); } catch (e) { check(`re-run ${file}`, false, e.message); }
}
check("all migrations re-runnable (idempotent)", true);

// ---- helpers ----------------------------------------------------------------------------------
async function as(role, sql, params = [], sub = null) {
  const claims = JSON.stringify(sub ? { role, sub } : { role });
  await db.exec(`RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claims', '${claims}', false);`);
  try { return { ok: true, rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { ok: false, err: e.message, code: e.code }; }
  finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claims','',false);"); }
}
const svc = (sql, p) => as("service_role", sql, p);
const fn = async (name, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(",");
  const r = await svc(`SELECT public.${name}(${ph}) AS r`, args);
  return r.ok ? { ok: true, r: r.rows[0].r } : r;
};
const items = (v, q, extra = {}) => JSON.stringify([{ productId: v.startsWith("v-doi") ? "p-doi" : "p-fish", variantId: v, quantity: q, ...extra }]);
let n = 0;
const mkOrder = (o = {}) => fn("create_order_server",
  o.name ?? "Tanvir Ahmed", o.phone ?? `0171347${String(7000 + ++n)}`, o.zone ?? "inside_dhaka", "Dhanmondi, Dhaka",
  "House 1 Road 2 Dhanmondi", null, o.coupon ?? null, o.method ?? "bkash", o.plan ?? "full",
  o.items ?? items("v-fish-1", 1), o.idem ?? null, o.ip ?? `iphash-${n}`);

// ---- 1. Attack tests (the shipped SQL file) ----------------------------------------------------
console.log("\n=== post_migration_checks.sql ===");
const res = await db.exec(read("verify/post_migration_checks.sql"));
const grid = res.find((r) => r.fields?.some((f) => f.name === "verdict"));
const fails = grid.rows.filter((r) => r.verdict !== "PASS");
console.log(`${grid.rows.length} checks, ${grid.rows.length - fails.length} PASS, ${fails.length} FAIL`);
for (const f of fails) console.log("  FAIL:", JSON.stringify(f));
check("shipped attack-test script: all PASS", fails.length === 0);

// ---- 2. Order creation & pricing --------------------------------------------------------------
console.log("\n=== order creation / pricing ===");
let r = await mkOrder({ method: "cod", plan: "cod", items: items("v-fish-1", 2, { unitPrice: 1, price: 1, lineTotal: 1 }) });
check("COD order created; client-sent prices ignored (2 x 500 + 70 = 1070)", r.ok && Number(r.r.totalAmount) === 1070 && Number(r.r.payableNow) === 0, JSON.stringify(r.ok ? r.r.totalAmount : r.err));
check("order code is SB-YYMM + 10 unambiguous chars", /^SB-\d{4}-[2-9A-HJ-NP-Z]{10}$/.test(r.r?.orderCode ?? ""), r.r?.orderCode);
let stock = (await svc("SELECT stock_qty FROM product_variants WHERE id='v-fish-1'")).rows[0].stock_qty;
check("stock decremented atomically (5 -> 3)", stock === 3, stock);

r = await mkOrder({ items: items("v-fish-1", 4) });
check("over-stock order rejected with safe message", !r.ok && /Insufficient stock/.test(r.err), r.err);
r = await mkOrder({ items: items("v-doi-1", 3) });
check("pre-order batch capacity enforced (8+3 > 10)", !r.ok && /fully booked/.test(r.err), r.err);
r = await mkOrder({ method: "sslcommerz", plan: "full" });
check("SSLCommerz rejected for new orders", !r.ok, r.err);
r = await mkOrder({ method: "cod", plan: "full" });
check("method/plan mismatch rejected", !r.ok, r.err);
r = await mkOrder({ phone: "12345" });
check("invalid phone rejected", !r.ok, r.err);
r = await mkOrder({ items: JSON.stringify([{ productId: "p-fish", variantId: "v-fish-1", quantity: 0 }]) });
check("quantity 0 rejected", !r.ok, r.err);
r = await mkOrder({ items: JSON.stringify([{ productId: "p-fish", variantId: "v-fish-1", quantity: 1, cuttingPreference: "Evil" }]) });
check("unknown cutting option rejected", !r.ok, r.err);

// coupons
await db.exec("UPDATE product_variants SET stock_qty = 100 WHERE id='v-fish-1'");
const co1 = await mkOrder({ coupon: "save10", items: items("v-fish-1", 2) });   // 1000 -> -100 + 70
check("coupon applied server-side (1000-100+70=970)", co1.ok && Number(co1.r.totalAmount) === 970 && Number(co1.r.discountAmount) === 100, co1.ok ? co1.r.totalAmount : co1.err);
r = await mkOrder({ coupon: "NOPE" });
check("invalid coupon rejected", !r.ok && /coupon/i.test(r.err), r.err);
await mkOrder({ coupon: "SAVE10", items: items("v-fish-1", 2) });
r = await mkOrder({ coupon: "SAVE10", items: items("v-fish-1", 2) });
check("coupon max_uses (2) enforced", !r.ok, r.err);

// idempotency
const idem = "idem-key-123456";
const o1 = await mkOrder({ idem, phone: "01713470001" });
const o2 = await mkOrder({ idem, phone: "01713470001" });
check("idempotency key returns same order", o2.ok && o2.r.orderCode === o1.r.orderCode && o2.r.idempotent === true);
const o3 = await mkOrder({ idem, phone: "01713470002" });
check("idempotency key bound to phone", !o3.ok, o3.err);

// advance plan
const adv = await mkOrder({ plan: "advance", method: "bkash", items: items("v-fish-1", 4) });  // 2000+70 ; 25% of 2000=500
check("advance payable = max(fee, 25% of discounted subtotal) = 500", adv.ok && Number(adv.r.payableNow) === 500 && Number(adv.r.totalAmount) === 2070, adv.ok ? adv.r.payableNow : adv.err);

// ---- 3. Payment flow ----------------------------------------------------------------------------
console.log("\n=== payment flow ===");
const paySetup = async (order, gw = "bkash") => {
  const b = await fn("begin_payment_attempt", order.orderCode, gw, "iphash1");
  if (!b.ok) return { b };
  const pid = "PID" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const a = await fn("attach_gateway_payment", b.r.attemptId, pid, JSON.stringify({ x: 1 }));
  const c = await fn("claim_payment_attempt", gw, pid);
  return { b, a, c, pid };
};
const orderRow = async (code) => (await svc("SELECT * FROM orders WHERE order_code=$1", [code])).rows[0];

const full = (await mkOrder({ method: "bkash", plan: "full", items: items("v-fish-1", 1) })).r;   // 570
let s = await paySetup(full);
check("begin_payment_attempt amount comes from DB (570)", s.b.ok && Number(s.b.r.amount) === 570 && s.b.r.purpose === "initial");
check("claim -> claimed", s.c.r?.state === "claimed");
const again = await fn("claim_payment_attempt", "bkash", s.pid);
check("concurrent/refreshed callback -> in_progress (no double execute)", again.r?.state === "in_progress");
const wrongGw = await fn("begin_payment_attempt", full.orderCode, "nagad", "x");
check("order locked to its payment method (nagad on bkash order rejected)", !wrongGw.ok, wrongGw.err);
const ref = s.c.r.attempt.gatewayOrderRef, aid = s.c.r.attempt.id;

let f = await fn("finalize_payment_attempt", aid, "TRX1AAA111", 50, "BDT", ref, "{}", "01700000000");
check("C2: cheap payment (50) on 570 order -> needs_review, NOT credited", f.r?.ok === false && f.r.reason === "amount_mismatch" && (await orderRow(full.orderCode)).payment_status === "pending", JSON.stringify(f.r));

// fresh attempt for wrong-merchant-ref test
let s2 = await paySetup(full);
check("order can start a new attempt after review", s2.b.ok && s2.c.r?.state === "claimed");
f = await fn("finalize_payment_attempt", s2.c.r.attempt.id, "TRX2BBB222", 570, "BDT", "SBPSOMEONEELSESREF", "{}", null);
check("merchantInvoiceNumber of another session -> rejected", f.r?.ok === false && f.r.reason === "merchant_reference_mismatch");
f = null;
let s3 = await paySetup(full);
let bad = await fn("finalize_payment_attempt", s3.c.r.attempt.id, "TRX3CCC333", 570, "USD", s3.c.r.attempt.gatewayOrderRef, "{}", null);
check("currency != BDT -> rejected", bad.r?.ok === false && bad.r.reason === "currency_mismatch");

let s4 = await paySetup(full);
const good = await fn("finalize_payment_attempt", s4.c.r.attempt.id, "TRXGOOD0001", 570, "BDT", s4.c.r.attempt.gatewayOrderRef, '{"trxID":"TRXGOOD0001"}', "01713470099");
let ord = await orderRow(full.orderCode);
check("verified payment settles order: paid + confirmed", good.r?.ok === true && ord.payment_status === "paid" && ord.order_status === "confirmed" && Number(ord.due_amount) === 0 && ord.paid_at, JSON.stringify(good.r));
const idemFin = await fn("finalize_payment_attempt", s4.c.r.attempt.id, "TRXGOOD0001", 570, "BDT", s4.c.r.attempt.gatewayOrderRef, "{}", null);
check("finalize is idempotent for the same trx", idemFin.r?.ok === true && idemFin.r.idempotent === true);
const afterPaid = await fn("begin_payment_attempt", full.orderCode, "bkash", "x");
check("paid order cannot start another payment", !afterPaid.ok, afterPaid.err);

// replay: SAME trxID on a DIFFERENT order
const victim = (await mkOrder({ method: "bkash", plan: "full", items: items("v-fish-1", 1) })).r;
let sv = await paySetup(victim);
const replay = await fn("finalize_payment_attempt", sv.c.r.attempt.id, "TRXGOOD0001", 570, "BDT", sv.c.r.attempt.gatewayOrderRef, "{}", null);
const vrow = await orderRow(victim.orderCode);
check("C1/C2: replayed trxID on another order -> trx_replay, not credited", replay.r?.ok === false && replay.r.reason === "trx_replay" && vrow.payment_status === "pending", JSON.stringify(replay.r));
const ev = (await svc("SELECT kind FROM security_events WHERE kind='payment_trx_replay'")).rows;
check("replay recorded as critical security event", ev.length >= 1);

// advance -> due flow
let sa = await paySetup(adv.r);
const advFin = await fn("finalize_payment_attempt", sa.c.r.attempt.id, "TRXADV00001", 500, "BDT", sa.c.r.attempt.gatewayOrderRef, "{}", null);
let arow = await orderRow(adv.r.orderCode);
check("advance payment -> advance_paid, due 1570", advFin.r?.ok && arow.payment_status === "advance_paid" && Number(arow.due_amount) === 1570, JSON.stringify(advFin.r));
let sd = await paySetup(adv.r, "nagad");   // due can be paid with any enabled gateway
check("due attempt: purpose=due, amount=1570 from DB", sd.b.ok && sd.b.r.purpose === "due" && Number(sd.b.r.amount) === 1570, JSON.stringify(sd.b.r ?? sd.b.err));
const dueFin = await fn("finalize_payment_attempt", sd.c.r.attempt.id, "NAGADISS0001", 1570, "BDT", sd.c.r.attempt.gatewayOrderRef, "{}", null);
arow = await orderRow(adv.r.orderCode);
check("due payment completes order: paid", dueFin.r?.ok && arow.payment_status === "paid" && Number(arow.advance_paid) === 2070, JSON.stringify(dueFin.r));

// COD cannot be paid online (H1)
const codOrder = (await mkOrder({ method: "cod", plan: "cod" })).r;
const codPay = await fn("begin_payment_attempt", codOrder.orderCode, "bkash", "x");
check("H1: COD order cannot be turned into an online payment", !codPay.ok, codPay.err);

// full-plan order can NOT be paid with a partial 'advance' (H1) -> amount is fixed from DB
const fo = (await mkOrder({ method: "nagad", plan: "full", items: items("v-fish-1", 2) })).r;
const fb = await fn("begin_payment_attempt", fo.orderCode, "nagad", "x");
check("H1: full-plan order amount fixed at total (1070), no client choice", fb.ok && Number(fb.r.amount) === 1070);

// cancellation with inventory/coupon restore
const stockBefore = (await svc("SELECT stock_qty FROM product_variants WHERE id='v-fish-1'")).rows[0].stock_qty;
const cu = (await svc("SELECT usage_count FROM coupons WHERE id='c1'")).rows[0].usage_count;
const toCancel = (await mkOrder({ method: "cod", plan: "cod", coupon: null, items: items("v-fish-1", 3) })).r;
const midStock = (await svc("SELECT stock_qty FROM product_variants WHERE id='v-fish-1'")).rows[0].stock_qty;
const canc = await fn("admin_set_order_status", toCancel.orderId, "cancelled", "00000000-0000-0000-0000-0000000000aa");
const afterStock = (await svc("SELECT stock_qty FROM product_variants WHERE id='v-fish-1'")).rows[0].stock_qty;
check("cancel restores stock", canc.ok && midStock === stockBefore - 3 && afterStock === stockBefore, `${stockBefore}->${midStock}->${afterStock}`);
const cancPaid = await fn("admin_set_order_status", full.orderId, "cancelled", "00000000-0000-0000-0000-0000000000aa");
check("paid order cannot be cancelled without refund", !cancPaid.ok, cancPaid.err);

// ---- 4. Admin ops --------------------------------------------------------------------------------
console.log("\n=== admin ops ===");
const actor = "00000000-0000-0000-0000-0000000000aa";
const onl = (await mkOrder({ method: "bkash", plan: "full" })).r;
let st = await fn("admin_set_order_status", onl.orderId, "confirmed", actor);
check("online order with no verified payment cannot be confirmed by admin", !st.ok, st.err);
const cod2 = (await mkOrder({ method: "cod", plan: "cod" })).r;
st = await fn("admin_set_order_status", cod2.orderId, "confirmed", actor);
check("COD order can be confirmed", st.ok);
st = await fn("admin_set_order_status", cod2.orderId, "pending", actor);
check("status cannot go backwards", !st.ok, st.err);
st = await fn("admin_set_order_status", cod2.orderId, "shipped", null);
check("admin actor required", !st.ok, st.err);
let mp = await fn("admin_mark_order_paid", cod2.orderId, 99999, "COD-REF-0001", "x", actor);
check("manual payment cannot exceed due", !mp.ok, mp.err);
mp = await fn("admin_mark_order_paid", cod2.orderId, Number(cod2.dueAmount), "COD-REF-0001", "collected", actor);
check("admin manual/COD settlement works", mp.ok && mp.r.paymentStatus === "paid");
const cod3 = (await mkOrder({ method: "cod", plan: "cod" })).r;
mp = await fn("admin_mark_order_paid", cod3.orderId, Number(cod3.dueAmount), "COD-REF-0001", "dup", actor);
check("manual reference cannot be reused (replay guard)", !mp.ok, mp.err);
const adj = await fn("admin_adjust_order_weight", cod3.orderId, -40, "weighed lighter", actor);
check("weight adjustment keeps totals consistent (constraint)", adj.ok && Number(adj.r.totalAmount) === Number(cod3.totalAmount) - 40, adj.err);

// ---- 5. Tracking, rate limit, guards ------------------------------------------------------------
console.log("\n=== tracking / rate limit / guards ===");
const phone = (await orderRow(full.orderCode)).customer_phone;
let tr = await fn("track_order_server", full.orderCode.toLowerCase(), phone.slice(-4));
check("track: correct code + last4 -> masked data, no full phone/address", tr.ok && tr.r && tr.r.maskedPhone.includes("****") && !JSON.stringify(tr.r).includes(phone) && !JSON.stringify(tr.r).includes("Road 2"));
tr = await fn("track_order_server", full.orderCode, "0000");
check("track: wrong last4 -> null (no oracle)", tr.ok && tr.r === null);
tr = await fn("track_order_server", "SB-0000-AAAAAAAAAA", "1234");
check("track: unknown code -> null", tr.ok && tr.r === null);

let last;
for (let i = 0; i < 4; i++) last = await fn("rate_limit_hit", "t:bucket", 60, 3);
check("rate limiter blocks the 4th hit in the window", last.r.allowed === false && last.r.retryAfter >= 1, JSON.stringify(last.r));

const guard = await as("authenticated", "UPDATE orders SET payment_status='paid'", [], "00000000-0000-0000-0000-000000000001");
check("authenticated UPDATE orders denied", !guard.ok, guard.err);
await db.exec(`INSERT INTO auth.users (id,email) VALUES ('00000000-0000-0000-0000-0000000000aa','admin@x.com'); INSERT INTO public.admins (user_id,email) VALUES ('00000000-0000-0000-0000-0000000000aa','admin@x.com');`);
let a1 = await as("authenticated", "SELECT count(*)::int AS n FROM orders", [], actor);
check("admin (in admins table) can READ orders", a1.ok && a1.rows[0].n > 5, JSON.stringify(a1.rows ?? a1.err));
let a2 = await as("authenticated", "UPDATE orders SET payment_status='paid' WHERE true", [], actor);
check("admin cannot WRITE orders directly (only audited service functions)", !a2.ok, a2.err);
let a3 = await as("authenticated", "UPDATE products SET title='Rui Premium' WHERE id='p-fish'", [], actor);
check("admin CAN edit catalogue via RLS", a3.ok);
let a4 = await as("authenticated", "SELECT bkash_app_key FROM site_settings", [], actor);
check("even admins cannot read gateway key columns via API", !a4.ok, a4.err);
let a5 = await as("anon", "SELECT public.is_admin()", []);
check("anon cannot call is_admin()", !a5.ok, a5.err);

await db.exec("UPDATE product_variants SET stock_qty = 1000 WHERE id='v-fish-1'");
const velocity = [];
for (let i = 0; i < 11; i++) velocity.push(await mkOrder({ method: "cod", plan: "cod", ip: "same-bot-ip" }));
check("per-IP velocity limit blocks the 11th order in an hour", velocity.slice(0, 10).every((x) => x.ok) && !velocity[10].ok, velocity[10].err);
const phoneFlood = [];
for (let i = 0; i < 6; i++) phoneFlood.push(await mkOrder({ method: "cod", plan: "cod", phone: "01799990000" }));
check("per-phone velocity limit blocks the 6th order in 3 hours", phoneFlood.slice(0, 5).every((x) => x.ok) && !phoneFlood[5].ok, phoneFlood[5].err);

// ---- 6. Hero banner CMS ----------------------------------------------------------------------------
console.log("\n=== hero banner CMS ===");
const J = JSON.stringify;
const nonAdmin = "00000000-0000-0000-0000-000000000001";
const heroGood = {
  imageUrl: "https://abc.supabase.co/storage/v1/object/public/site-media/hero/a1.webp",
  imageAlt: "alt text", imagePosition: "center", badgeText: "Badge", badgeIcon: "fish",
  title: "New slide", subtitle: "sub", ctaText: "Shop", ctaLink: "/shop", isActive: true,
};
const heroCount = async (role, sub = null) => (await as(role, "SELECT count(*)::int AS n FROM hero_slides", [], sub));

check("hero: 4 default slides + settings seeded",
  (await svc("SELECT count(*)::int AS n FROM hero_slides")).rows[0].n === 4 &&
  (await svc("SELECT count(*)::int AS n FROM hero_settings")).rows[0].n === 1);
let c = await heroCount("anon");
check("hero: anon can read the visible slides", c.ok && c.rows[0].n === 4, JSON.stringify(c.rows ?? c.err));
check("hero: anon can read hero settings", (await as("anon", "SELECT headline FROM hero_settings")).ok);

let hs = await fn("admin_hero_save_slide", actor, J(heroGood));
check("hero: admin creates a slide (appended last)", hs.ok && hs.r.slide.sortOrder === 5 && hs.r.slide.title === "New slide", hs.err);
const slideId = hs.r?.slide?.id;

const rejects = async (label, patch) => {
  const r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, ...patch }));
  check(`hero: rejects ${label}`, !r.ok && !/violates|constraint/i.test(r.err ?? ""), r.err);
};
await rejects("javascript: link", { ctaLink: "javascript:alert(1)" });
await rejects("protocol-relative link", { ctaLink: "//evil.example/x" });
await rejects("http (non-TLS) link", { ctaLink: "http://evil.example" });
await rejects("path-traversal image path", { imageUrl: "/images/../etc/passwd" });
await rejects("data: URI image", { imageUrl: "data:image/svg+xml;base64,PHN2Zz4=" });
await rejects("image URL pointing outside the site-media bucket", { imageUrl: "https://abc.supabase.co/storage/v1/object/public/other-bucket/x.png" });
await rejects("empty title", { title: "   " });
await rejects("over-long title (121)", { title: "x".repeat(121) });
await rejects("unknown badge icon", { badgeIcon: "skull" });
await rejects("button text without a link", { ctaLink: "" });
await rejects("end date before start date", { startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" });
await rejects("garbage id", { id: "not-a-uuid" });
r = await fn("admin_hero_save_slide", null, J(heroGood));
check("hero: admin identity required", !r.ok, r.err);
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, title: "<b>Hi</b><script>", ctaText: "", ctaLink: "" }));
check("hero: angle brackets stripped from text", r.ok && !/[<>]/.test(r.r.slide.title), r.ok ? r.r.slide.title : r.err);
await fn("admin_hero_delete_slide", actor, r.r.slide.id);

// update + orphan detection
const newImg = "https://abc.supabase.co/storage/v1/object/public/site-media/hero/b2.webp";
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, id: slideId, imageUrl: newImg, title: "Edited" }));
check("hero: update works and reports the replaced upload as orphaned", r.ok && r.r.slide.title === "Edited" && r.r.orphanedImageUrl === heroGood.imageUrl, r.err ?? JSON.stringify(r.r));
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, id: slideId, imageUrl: "/images/banners/hero-jamuna-river-dawn.jpg" }));
check("hero: swapping to a built-in image reports the old upload as orphaned", r.ok && r.r.orphanedImageUrl === newImg, r.err ?? JSON.stringify(r.r));
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, id: slideId, imageUrl: "/images/banners/hero-gawa-ghee-bogura-doi.jpg" }));
check("hero: built-in /images/ assets are never reported as orphans", r.ok && r.r.orphanedImageUrl === null, r.err ?? JSON.stringify(r.r));
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, id: "11111111-1111-1111-1111-111111111111" }));
check("hero: updating a missing slide fails cleanly", !r.ok && /not found/i.test(r.err), r.err);

// visibility
await fn("admin_hero_set_active", actor, slideId, false);
c = await heroCount("anon");
check("hero: hidden slide is invisible to the public", c.rows[0].n === 4, c.rows[0].n);
c = await heroCount("authenticated", nonAdmin);
check("hero: non-admin signed-in user cannot see hidden slides", c.rows[0].n === 4, c.rows[0].n);
c = await heroCount("authenticated", actor);
check("hero: admin sees hidden slides (to manage them)", c.rows[0].n === 5, c.rows[0].n);
await fn("admin_hero_set_active", actor, slideId, true);
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, startsAt: "2999-01-01T00:00:00Z", title: "Future" }));
c = await heroCount("anon");
check("hero: scheduled-for-the-future slide is not public yet", r.ok && c.rows[0].n === 5, c.rows[0].n);
await fn("admin_hero_delete_slide", actor, r.r.slide.id);
r = await fn("admin_hero_save_slide", actor, J({ ...heroGood, endsAt: "2001-01-01T00:00:00Z", title: "Expired" }));
c = await heroCount("anon");
check("hero: expired slide disappears from the public", r.ok && c.rows[0].n === 5, c.rows[0].n);
await fn("admin_hero_delete_slide", actor, r.r.slide.id);

// reorder
let ids = (await svc("SELECT id FROM hero_slides ORDER BY sort_order")).rows.map((x) => x.id);
const reversed = [...ids].reverse();
r = await fn("admin_hero_reorder", actor, `{${reversed.join(",")}}`);
let after = (await svc("SELECT id FROM hero_slides ORDER BY sort_order")).rows.map((x) => x.id);
check("hero: reorder applies the requested order", r.ok && J(after) === J(reversed), r.err);
r = await fn("admin_hero_reorder", actor, `{${ids.slice(1).join(",")}}`);
check("hero: reorder with a missing slide is rejected", !r.ok, r.err);
r = await fn("admin_hero_reorder", actor, `{${[ids[0], ...ids.slice(0, -1)].join(",")}}`);
check("hero: reorder with duplicates is rejected", !r.ok, r.err);

// delete + renumber
r = await fn("admin_hero_delete_slide", actor, slideId);
const orders = (await svc("SELECT sort_order FROM hero_slides ORDER BY sort_order")).rows.map((x) => x.sort_order);
check("hero: delete removes the slide and keeps sort_order gap-free", r.ok && r.r.deleted === true && J(orders) === "[1,2,3,4]", r.err ?? J(orders));
r = await fn("admin_hero_delete_slide", actor, slideId);
check("hero: deleting twice fails cleanly", !r.ok && /not found/i.test(r.err), r.err);

// max slides
let heroLast;
for (let i = 0; i < 9; i++) heroLast = await fn("admin_hero_save_slide", actor, J({ ...heroGood, title: `Bulk ${i}` }));
check("hero: slide count is capped at 12", !heroLast.ok && /at most 12/.test(heroLast.err), heroLast.err);
await svc("DELETE FROM hero_slides WHERE title LIKE 'Bulk %'");

// settings
const goodSettings = {
  showHeadline: true, headline: "H", subheadline: "S", showGuarantee: true, guaranteeText: "G", showCounter: false,
  autoplay: true, autoplaySeconds: 6, showTrustItems: true,
  trustItems: [{ icon: "leaf", title: "T1", subtitle: "s1" }, { icon: "truck", title: "T2", subtitle: "" }],
};
r = await fn("admin_hero_save_settings", actor, J(goodSettings));
const heroSaved = (await svc("SELECT * FROM hero_settings")).rows[0];
check("hero: settings saved", r.ok && heroSaved.headline === "H" && Number(heroSaved.autoplay_seconds) === 6 && heroSaved.show_counter === false && heroSaved.trust_items.length === 2, r.err);
const badSettings = async (label, patch) => {
  const x = await fn("admin_hero_save_settings", actor, J({ ...goodSettings, ...patch }));
  check(`hero: settings reject ${label}`, !x.ok && !/violates|constraint/i.test(x.err ?? ""), x.err);
};
await badSettings("slide duration of 1s", { autoplaySeconds: 1 });
await badSettings("slide duration of 99s", { autoplaySeconds: 99 });
await badSettings("7 highlights", { trustItems: Array.from({ length: 7 }, () => ({ icon: "leaf", title: "t", subtitle: "" })) });
await badSettings("unknown highlight icon", { trustItems: [{ icon: "skull", title: "t", subtitle: "" }] });
await badSettings("highlight without a title", { trustItems: [{ icon: "leaf", title: "", subtitle: "" }] });
await badSettings("non-boolean flag", { autoplay: "yes" });
await badSettings("over-long headline", { headline: "x".repeat(161) });

// anon has no write grants
for (const op of [
  "UPDATE hero_slides SET title='pwn'",
  "INSERT INTO hero_slides (image_url,title) VALUES ('/images/a.jpg','x')",
  "DELETE FROM hero_slides",
  "UPDATE hero_settings SET headline='pwn'"
]) {
  let x = await as("anon", op);
  check("hero: anon cannot write directly", !x.ok, x.err);
}

// non-admin cannot tamper with rows under RLS
let naIns = await as("authenticated", "INSERT INTO hero_slides (image_url,title) VALUES ('/images/a.jpg','x')", [], nonAdmin);
check("hero: non-admin cannot INSERT hero_slides", !naIns.ok, naIns.err);
await as("authenticated", "UPDATE hero_slides SET title='pwn'", [], nonAdmin);
await as("authenticated", "DELETE FROM hero_slides", [], nonAdmin);
await as("authenticated", "UPDATE hero_settings SET headline='pwn'", [], nonAdmin);
let heroUntampered = (await svc("SELECT count(*)::int AS n FROM hero_slides WHERE title='pwn'")).rows[0].n === 0
                  && (await svc("SELECT headline FROM hero_settings")).rows[0].headline !== 'pwn';
check("hero: non-admin cannot UPDATE or DELETE hero CMS rows under RLS", heroUntampered);
let heroAdminSettingsUpdate = await as("authenticated", "UPDATE hero_settings SET headline='Admin Live Headline' WHERE id=1", [], actor);
check("hero: admin CAN update hero_settings directly via RLS", heroAdminSettingsUpdate.ok, heroAdminSettingsUpdate.err);
let heroAdminSlideUpdate = await as("authenticated", "UPDATE hero_slides SET title='Admin Live Title' WHERE sort_order=1", [], actor);
check("hero: admin CAN update hero_slides directly via RLS", heroAdminSlideUpdate.ok, heroAdminSlideUpdate.err);
r = await as("anon", "SELECT public.admin_hero_save_slide(null, '{}'::jsonb)");
check("hero: anon cannot call admin_hero_save_slide", !r.ok, r.err);
r = await as("authenticated", "SELECT public.admin_hero_delete_slide(gen_random_uuid(), gen_random_uuid())", [], actor);
check("hero: even an admin session cannot call the RPCs from the browser", !r.ok, r.err);
r = await svc("INSERT INTO hero_slides (image_url,title,cta_link) VALUES ('/images/a.jpg','x','javascript:alert(1)')");
check("hero: table CHECK rejects unsafe links even for the service role", !r.ok && /check/i.test(r.err), r.err);
r = await svc("INSERT INTO hero_slides (image_url,title) VALUES ('https://evil.example/x.png','x')");
check("hero: table CHECK rejects foreign image hosts even for the service role", !r.ok && /check/i.test(r.err), r.err);

// reset to defaults
await fn("admin_hero_save_slide", actor, J({ ...heroGood, title: "Temp" }));
r = await fn("admin_hero_reset_defaults", actor);
const afterReset = (await svc("SELECT count(*)::int AS n, (SELECT headline FROM hero_settings) AS h FROM hero_slides")).rows[0];
check("hero: restore-defaults brings back the 4 original slides + copy", r.ok && afterReset.n === 4 && afterReset.h.startsWith("সাধ্যের বাজার") && r.r.orphanedImageUrls.includes(heroGood.imageUrl), r.err ?? J(afterReset));

// audit trail
const aud = (await svc("SELECT count(*)::int AS n FROM admin_audit_log WHERE action LIKE 'hero.%' AND actor = $1", [actor])).rows[0].n;
check("hero: every admin change is audited", aud >= 10, aud);

// storage policies (bucket `site-media`)
const heroObj = (name) => `INSERT INTO storage.objects (bucket_id, name) VALUES ('site-media', '${name}')`;
check("hero: storage bucket is public, image-only and size-capped",
  (await svc("SELECT 1 FROM storage.buckets WHERE id='site-media' AND public AND file_size_limit = 3145728 AND NOT ('image/svg+xml' = ANY(allowed_mime_types))")).rows.length === 1);
r = await as("authenticated", heroObj("hero/ok.webp"), [], actor);
check("hero: admin can upload to site-media/hero/", r.ok, r.err);
r = await as("authenticated", heroObj("other/x.webp"), [], actor);
check("hero: admin cannot upload outside hero/", !r.ok, r.err);
r = await as("authenticated", heroObj("hero/evil.webp"), [], nonAdmin);
check("hero: non-admin user cannot upload", !r.ok, r.err);
r = await as("anon", heroObj("hero/evil.webp"));
check("hero: anon cannot upload", !r.ok, r.err);
r = await as("authenticated", "DELETE FROM storage.objects WHERE name='hero/ok.webp'", [], nonAdmin);
check("hero: non-admin cannot delete uploads", r.ok && (await svc("SELECT 1 FROM storage.objects WHERE name='hero/ok.webp'")).rows.length === 1);
r = await as("authenticated", "DELETE FROM storage.objects WHERE name='hero/ok.webp'", [], actor);
check("hero: admin can delete uploads", r.ok && (await svc("SELECT 1 FROM storage.objects WHERE name='hero/ok.webp'")).rows.length === 0);

// pre-order batch cms tests
let preAnonRead = await as("anon", "SELECT headline, batch_status FROM preorder_settings WHERE id = 1");
check("preorder: anon can read preorder settings", preAnonRead.ok && preAnonRead.rows[0].batch_status === "booking_open");

let preAnonWrite = await as("anon", "UPDATE preorder_settings SET headline = 'hacked' WHERE id = 1");
check("preorder: anon cannot write preorder settings", !preAnonWrite.ok, preAnonWrite.err);

let preNonAdminWrite = await as("authenticated", "UPDATE preorder_settings SET headline = 'hacked' WHERE id = 1", [], nonAdmin);
let preUntampered = (await svc("SELECT headline FROM preorder_settings WHERE id = 1")).rows[0].headline !== "hacked";
check("preorder: non-admin cannot update preorder settings under RLS", preUntampered);

let preAdminUpdate = await as("authenticated", "UPDATE preorder_settings SET headline = 'Admin Live Batch Headline' WHERE id = 1", [], actor);
check("preorder: admin can update preorder settings directly via RLS", preAdminUpdate.ok, preAdminUpdate.err);

r = await fn("admin_preorder_save_settings", actor, J({
  badgeText: "LIMITED PRE-ORDER BATCH",
  headline: "Fresh River Fish Dispatch",
  subheadline: "Caught at dawn",
  cutoffTime: "2026-11-10T16:00:00Z",
  expectedDeliveryDate: "Saturday Morning Batch",
  dispatchLocation: "Sirajganj Ghat",
  closedMessage: "Batch is fully booked",
  batchStatus: "booking_open",
  isBatchActive: true,
  showCountdown: true,
  requireAdvancePayment: true,
  advancePercent: 25,
  bannerAlert: "Few slots left",
  showBannerAlert: true,
  maxBatchCapacity: 300,
}));
check("preorder: admin RPC saves settings and returns row", r.ok && r.r.saved === true && r.r.settings.headline === "Fresh River Fish Dispatch", r.err);

r = await fn("admin_preorder_sync_product_dates", actor, "2026-11-10T16:00:00Z", "Saturday Morning Batch");
check("preorder: admin RPC syncs dates to pre-order products", r.ok && r.r.updated >= 1, r.err);

r = await fn("admin_preorder_reset_batch_booked", actor);
check("preorder: admin RPC resets booked quantities for all pre-order products", r.ok && typeof r.r.reset === "number", r.err);

let preBadStatus = await svc("UPDATE preorder_settings SET batch_status = 'invalid_status' WHERE id = 1");
check("preorder: table CHECK constraint rejects invalid status", !preBadStatus.ok && /check/i.test(preBadStatus.err), preBadStatus.err);

let preBadAdvance = await svc("UPDATE preorder_settings SET advance_percent = 150 WHERE id = 1");
check("preorder: table CHECK constraint rejects advance percent > 100", !preBadAdvance.ok && /check/i.test(preBadAdvance.err), preBadAdvance.err);

const preAud = (await svc("SELECT count(*)::int AS n FROM admin_audit_log WHERE action LIKE 'preorder.%' AND actor = $1", [actor])).rows[0].n;
check("preorder: admin actions are audited", preAud >= 3, preAud);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

