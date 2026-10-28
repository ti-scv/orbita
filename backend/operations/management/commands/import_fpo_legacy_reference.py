import hashlib,json
from pathlib import Path
from django.core.management.base import BaseCommand,CommandError
from core.models import Unit
from operations.fpo_reference import import_references

class Command(BaseCommand):
    help="Importa referência FPO legada; não executa procedures nem coleta programada."
    def add_arguments(self,p):
        p.add_argument("--file",required=True);p.add_argument("--unit",default="scv")
    def handle(self,*args,**opts):
        p=Path(opts["file"]);raw=p.read_bytes()
        if len(raw)>15_000_000:raise CommandError("Arquivo excede o limite de importação")
        try:result=import_references(Unit.objects.get(slug=opts["unit"]),json.loads(raw),hashlib.sha256(raw).hexdigest())
        except (ValueError,TypeError,KeyError) as e:raise CommandError(str(e)) from None
        self.stdout.write(json.dumps(result,ensure_ascii=False))
