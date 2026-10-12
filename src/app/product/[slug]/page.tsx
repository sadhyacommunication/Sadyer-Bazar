import React from "react";
import { INITIAL_PRODUCTS } from "@/services/seedData";
import ProductDetailClient from "./ProductDetailClient";

export function generateStaticParams() {
  return INITIAL_PRODUCTS.map((product) => ({
    slug: product.slug,
  }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
