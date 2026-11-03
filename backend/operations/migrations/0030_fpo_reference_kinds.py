from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies=[("operations","0029_report_application_connections")]
    operations=[migrations.AlterField(model_name="reportsnapshotconfiguration",name="dataset_kind",field=models.CharField(max_length=20,default="beds",choices=[("beds","Leitos totais"),("capacity","Capacidade SUS/convênio"),("lives","Vidas Sansaúde"),("fpo_quotas","FPO · cotas históricas"),("fpo_mapping","FPO · de/para histórico")]))]
