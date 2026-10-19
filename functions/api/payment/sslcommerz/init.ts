/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/sslcommerz/init
 * Automated SSLCommerz Hosted Session Initiation (PCI-DSS SAQ A Zero-Trust)
 * 
 * Rules:
 * - Amount is strictly calculated from the database using service_role. Never trusted from client.
 * - Stores credentials in environment variables / Cloudflare secrets only.
 * - Redirects to official SSLCommerz hosted payment page (Cards, bKash, Nagad, Rocket, Net Banking).
 */

interface Env {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SSLCOMMERZ_STORE_ID?: string;
  SSLCOMMERZ_STORE_PASSWORD?: string;
  SSLCOMMERZ_IS_LIVE?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { orderCode, paymentType = "full" } = body as {
      orderCode?: string;
      paymentType?: "full" | "advance" | "due";
    };

    if (!orderCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required orderCode" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Supabase service credentials not configured on server",
        }),
        { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 1. Fetch genuine order record from database (Zero Client Trust)
    const orderRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(
        orderCode.trim().toUpperCase()
      )}&select=*`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!orderRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Database error fetching order" }),
        { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const orders = await orderRes.json();
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Order ${orderCode} not found` }),
        { status: 404, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const order = orders[0];

    // Check if order is already paid
    if (order.payment_status === "paid" && order.due_amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This order is already fully paid.",
        }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 2. Strict Server-Side Payable Calculation
    let payableAmount: number;
    if (paymentType === "due") {
      payableAmount = Number(order.due_amount);
    } else if (order.payment_plan === "full") {
      payableAmount = Number(order.total_amount);
    } else if (order.payment_plan === "advance") {
      if (Number(order.advance_paid) > 0) {
        payableAmount = Number(order.due_amount);
      } else {
        // Initial advance payable
        const calculatedAdvance = Number(order.total_amount) - Number(order.due_amount);
        payableAmount = calculatedAdvance > 0 ? calculatedAdvance : Number(order.delivery_charge);
      }
    } else {
      payableAmount = Number(order.total_amount);
    }

    // Safeguard payable amount
    if (isNaN(payableAmount) || payableAmount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Calculated payable amount is invalid or zero",
        }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 3. Resolve SSLCommerz Credentials & Base URL
    const isLive = env.SSLCOMMERZ_IS_LIVE === "true";
    let storeId = env.SSLCOMMERZ_STORE_ID?.trim() || "";
    let storePasswd = env.SSLCOMMERZ_STORE_PASSWORD?.trim() || "";

    // Test Sandbox Fallback if credentials not provided in test mode
    if (!storeId || !storePasswd) {
      if (!isLive) {
        storeId = "testbox";
        storePasswd = "qwerty";
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "SSLCommerz Live credentials not configured. Please configure SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.",
          }),
          { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
        );
      }
    }

    // Determine absolute site URL for return callbacks
    const siteUrl = (
      env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin ||
      "https://sadhyerbazar.com"
    ).replace(/\/$/, "");

    const sslGatewayUrl = isLive
      ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
      : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

    // 4. Construct SSLCommerz Session Parameters
    const params = new URLSearchParams();
    params.set("store_id", storeId);
    params.set("store_passwd", storePasswd);
    params.set("total_amount", payableAmount.toFixed(2));
    params.set("currency", "BDT");
    params.set("tran_id", order.order_code);
    params.set("success_url", `${siteUrl}/api/payment/sslcommerz/success`);
    params.set("fail_url", `${siteUrl}/api/payment/sslcommerz/fail`);
    params.set("cancel_url", `${siteUrl}/api/payment/sslcommerz/cancel`);
    params.set("ipn_url", `${siteUrl}/api/payment/webhook`);

    // Customer Information
    params.set("cus_name", String(order.customer_name || "Valued Customer").trim());
    params.set(
      "cus_email",
      order.customer_email || "customer@sadhyerbazar.com"
    );
    params.set(
      "cus_add1",
      String(order.customer_address || "Dhaka, Bangladesh").trim().substring(0, 150)
    );
    params.set(
      "cus_city",
      String(order.customer_district || "Dhaka").trim()
    );
    params.set("cus_state", "Bangladesh");
    params.set("cus_postcode", "1200");
    params.set("cus_country", "Bangladesh");
    params.set(
      "cus_phone",
      String(order.customer_phone || "01700000000").trim()
    );

    // Shipping & Product Details
    params.set("shipping_method", "Courier");
    params.set("num_of_item", "1");
    params.set("ship_name", String(order.customer_name || "Customer").trim());
    params.set(
      "ship_add1",
      String(order.customer_address || "Dhaka").trim().substring(0, 150)
    );
    params.set(
      "ship_city",
      String(order.customer_district || "Dhaka").trim()
    );
    params.set("ship_country", "Bangladesh");
    params.set("ship_postcode", "1200");

    params.set("product_name", `Sadyer Bazar Order ${order.order_code}`);
    params.set("product_category", "Organic Food & Groceries");
    params.set("product_profile", "physical-goods");

    // 5. Initiate SSLCommerz Gateway Session
    const sslRes = await fetch(sslGatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!sslRes.ok) {
      const errText = await sslRes.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: "SSLCommerz session initialization failed",
          details: errText,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const sslData = (await sslRes.json()) as {
      status: string;
      failedreason?: string;
      sessionkey?: string;
      GatewayPageURL?: string;
      redirectGatewayURL?: string;
    };

    if (sslData.status === "SUCCESS" && sslData.GatewayPageURL) {
      return new Response(
        JSON.stringify({
          success: true,
          GatewayPageURL: sslData.GatewayPageURL,
          sessionkey: sslData.sessionkey,
          orderCode: order.order_code,
          payableAmount,
          currency: "BDT",
        }),
        { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error:
          sslData.failedreason ||
          "SSLCommerz could not generate checkout session",
        sslStatus: sslData.status,
      }),
      { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error initiating SSLCommerz payment",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  }
}
