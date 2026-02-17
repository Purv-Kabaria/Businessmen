import { cookies } from "next/headers";
import { createSuccessResponse, handleUnexpectedError } from "@/lib/api-utils";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("token");

    return createSuccessResponse(
      { message: "You have been logged out successfully." },
      200
    );
  } catch (error) {
    return handleUnexpectedError(error, "LOGOUT");
  }
}
