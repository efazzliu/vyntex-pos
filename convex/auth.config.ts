import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.HERCULES_OIDC_AUTHORITY!,
      applicationID: process.env.HERCULES_OIDC_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
