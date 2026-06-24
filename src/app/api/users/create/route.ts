import { NextResponse } from "next/server";
import { createUserAction } from "@/actions/users.actions";
import { log } from "@/lib/logger";
import { withAxiom } from "@/lib/axiom/server";

const xlog = log("api:users-create");

export const POST = withAxiom(async (request: Request) => {
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
});
