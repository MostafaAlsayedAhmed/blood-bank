"use client";

import { createAuthClient } from "better-auth/react";

// Browser-side client for sign-in only. Authorization never happens on the client.
export const authClient = createAuthClient();
