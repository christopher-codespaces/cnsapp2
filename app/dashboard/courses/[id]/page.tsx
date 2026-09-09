"use client";

import { useParams } from "next/navigation";
import CourseBuilder from "@/components/course/CourseBuilder";

export default function CourseEditorPage() {
  const params = useParams<{ id: string }>();
  return <CourseBuilder id={params.id} />;
}
