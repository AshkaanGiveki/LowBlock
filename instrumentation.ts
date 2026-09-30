export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startSportsApiBackgroundService } = await import(
        "@/lib/football/sportsapi/backgroundService"
      );
      startSportsApiBackgroundService();
    } catch (err) {
      console.error(
        "[Instrumentation] Failed to start SportsApiBackgroundService:",
        err,
      );
    }
  }
}
