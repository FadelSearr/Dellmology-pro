"""
Model Retrain Scheduler
Provides a configurable scheduler that can be started, rescheduled,
and queried at runtime. Uses APScheduler cron jobs.
"""

import logging
import threading
from typing import Callable, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# Module-level scheduler and job handle
_scheduler: Optional[BackgroundScheduler] = None
_job_id = "retrain_job"
_current_cron: Optional[str] = None
_eval_job_id = "evaluate_job"
_current_eval_cron: Optional[str] = None

# Lock to protect scheduler init/teardown and job modifications
_lock = threading.Lock()


def start_scheduler(job_func: Callable, cron_expr: str = "0 17 * * 1-5", epochs: int = 5):
    """Start the retraining scheduler with a cron expression.

    cron_expr: standard 5-field cron (minute hour day month dow)
    epochs: default epochs passed to job_func when invoked
    """
    global _scheduler, _current_cron
    with _lock:
        if _scheduler is None:
            _scheduler = BackgroundScheduler()
        else:
            try:
                _scheduler.remove_job(_job_id)
            except Exception:
                pass

    # Parse cron expression (minute hour day month dow)
    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError("cron_expr must be 5 space-separated fields: 'min hour day month dow'")
    minute, hour, day, month, dow = parts
    trigger = CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=dow)

    def _wrapped_job():
        try:
            job_func(epochs=epochs)
        except TypeError:
            # fallback if job_func signature is different
            job_func()

    _scheduler.add_job(_wrapped_job, trigger, id=_job_id, replace_existing=True)
    try:
        if not getattr(_scheduler, 'running', False):
            _scheduler.start()
    except Exception:
        # Some APScheduler versions expose `state` instead of `running`
        try:
            if getattr(_scheduler, 'state', None) != 1:  # STATE_STOPPED == 1
                _scheduler.start()
        except Exception:
            pass
    _current_cron = cron_expr
    logger.info(f"Retraining scheduler started with cron: {_current_cron}")


def start_eval_scheduler(eval_func: Callable, cron_expr: str = "0 19 * * *"):
    """Start a scheduled evaluation job which can call an evaluate/promote function.

    cron_expr: standard 5-field cron (minute hour day month dow)
    """
    global _scheduler, _current_eval_cron
    with _lock:
        if _scheduler is None:
            _scheduler = BackgroundScheduler()
        else:
            try:
                _scheduler.remove_job(_eval_job_id)
            except Exception:
                pass

    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError("cron_expr must be 5 space-separated fields: 'min hour day month dow'")
    minute, hour, day, month, dow = parts
    trigger = CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=dow)

    def _wrapped_eval():
        try:
            eval_func()
        except Exception:
            logger.exception('Scheduled evaluation job failed')

    _scheduler.add_job(_wrapped_eval, trigger, id=_eval_job_id, replace_existing=True)
    try:
        if not getattr(_scheduler, 'running', False):
            _scheduler.start()
    except Exception:
        try:
            if getattr(_scheduler, 'state', None) != 1:
                _scheduler.start()
        except Exception:
            pass
    _current_eval_cron = cron_expr
    logger.info(f"Evaluation scheduler started with cron: {_current_eval_cron}")


def reschedule(cron_expr: str, epochs: int = 5):
    """Reschedule the retrain job to a new cron expression."""
    global _scheduler
    if _scheduler is None:
        raise RuntimeError("Scheduler not started")
    # Use start_scheduler to replace the existing job with the new cron
    start_scheduler(lambda epochs=epochs: None, cron_expr=cron_expr, epochs=epochs)


def reschedule_eval(cron_expr: str):
    """Reschedule the evaluation job to a new cron expression."""
    if _scheduler is None:
        raise RuntimeError("Scheduler not started")
    start_eval_scheduler(lambda: None, cron_expr=cron_expr)


def get_status():
    """Return a dict with scheduler status and current cron."""
    global _scheduler, _current_cron
    with _lock:
        status = {
            'running': bool(_scheduler and _scheduler.running),
            'cron': _current_cron,
            'job_id': _job_id,
        }
        try:
            if _scheduler and _scheduler.get_job(_job_id):
                job = _scheduler.get_job(_job_id)
                status['next_run_time'] = str(job.next_run_time)
            else:
                status['next_run_time'] = None
        except Exception:
            status['next_run_time'] = None
        return status


def get_eval_status():
    """Return evaluation scheduler status and cron."""
    global _scheduler, _current_eval_cron
    with _lock:
        status = {
            'running': bool(_scheduler and _scheduler.running),
            'cron': _current_eval_cron,
            'job_id': _eval_job_id,
        }
        try:
            if _scheduler and _scheduler.get_job(_eval_job_id):
                job = _scheduler.get_job(_eval_job_id)
                status['next_run_time'] = str(job.next_run_time)
            else:
                status['next_run_time'] = None
        except Exception:
            status['next_run_time'] = None
        return status


def stop_scheduler():
    global _scheduler
    with _lock:
        if _scheduler:
            try:
                # Remove only the retrain job; leave other jobs intact
                _scheduler.remove_job(_job_id)
            except Exception:
                pass
            try:
                # If there are no remaining jobs, shutdown and clear scheduler
                if not _scheduler.get_jobs():
                    _scheduler.shutdown(wait=False)
                    _scheduler = None
            except Exception:
                try:
                    _scheduler.shutdown(wait=False)
                except Exception:
                    pass
            logger.info('Retrain scheduler stopped')


def stop_eval_scheduler():
    global _scheduler, _current_eval_cron
    with _lock:
        if _scheduler:
            try:
                _scheduler.remove_job(_eval_job_id)
            except Exception:
                pass
            try:
                if not _scheduler.get_jobs():
                    _scheduler.shutdown(wait=False)
                    _scheduler = None
            except Exception:
                try:
                    _scheduler.shutdown(wait=False)
                except Exception:
                    pass
    _current_eval_cron = None
    logger.info('Evaluation scheduler stopped')
