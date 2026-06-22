"use client";

import { use } from "react";
import { ArticleForm } from "@/components/article-form";

export default function EditArtikelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ArticleForm articleId={id} />;
}
