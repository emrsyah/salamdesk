import { NextResponse } from "next/server";
import { createUserAction } from "@/actions/users.actions";
import { log } from "@/lib/logger";

const xlog = log("api:users-create");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await createUserAction(formData);
    return NextResponse.json(result);
  } catch (error) {
    xlog.error({ err: error }, "failed to create user");
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membuat user" },
      { status: 500 }
    );
  }
}
