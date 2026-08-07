"""Run singleton background jobs separately from horizontally scaled API workers."""
import asyncio
import logging

from server import notification_outbox_loop, reservation_reaper_loop


async def main() -> None:
    logging.getLogger(__name__).info("Starting Perfurm background workers")
    await asyncio.gather(reservation_reaper_loop(), notification_outbox_loop())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
