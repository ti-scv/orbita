from celery import shared_task


@shared_task(name="core.sync_remote_users")
def sync_remote_users():
    from core.models import RemoteInstance
    from core.user_sync import sync_users

    for connection in RemoteInstance.objects.filter(enabled=True).iterator():
        sync_users(connection)
