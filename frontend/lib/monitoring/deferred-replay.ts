import * as Sentry from "@sentry/nextjs";

let initialized = false;

/** Adds the Replay integration only after critical page work has completed. */
export const initializeDeferredReplay = () => {
  if (initialized) return;

  const client = Sentry.getClient();
  if (!client) return;

  initialized = true;
  client.addIntegration(
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  );
};
