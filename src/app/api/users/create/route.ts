import { NextResponse } from "next/server";
import { createUserAction } from "@/actions/users.actions";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await createUserAction(formData);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membuat user" },
      { status: 500 }
    );
  }
}
