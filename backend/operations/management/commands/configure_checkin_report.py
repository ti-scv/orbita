"""Create a disabled local check-in Canvas draft, without grants or delivery."""
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import Unit
from operations.checkin_report import HANDLER
from operations.models import ReportDefinition
from operations.report_canvas.ports import tabular, block, image_asset
from operations.report_canvas.schema import validate_layout

class Command(BaseCommand):
    help = "Cria relatório de check-in desativado para uma unidade habilitada."

    def add_arguments(self, parser):
        parser.add_argument("--unit", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        unit = Unit.objects.filter(slug=options["unit"], checkin_enabled=True).first()
        if not unit:
            raise CommandError("Unidade não encontrada ou check-in desabilitado.")
        if ReportDefinition.objects.filter(unit=unit, code="checkin-summary").exists():
            raise CommandError("Relatório já existe; nenhuma alteração aplicada.")
        report = ReportDefinition.objects.create(
            unit=unit, code="checkin-summary", name="Check-in dos agendamentos",
            source="local", handler=HANDLER, reviewed=True, enabled=False,
            manual_enabled=False, canvas_enabled=False, output_format="pdf",
            parameter_schema={"start": {"type": "date", "required": True},
                              "end": {"type": "date", "required": True, "not_before": "start"}},
        )
        layout = tabular(report)
        icon = block("checkin_icon", "image", 32, 24, 42, 42)
        icon["asset_id"] = image_asset(report, Path(__file__).resolve().parents[2] / "assets" / "checkin-lightbulb.png")
        layout["pages"][0]["blocks"].insert(0, icon)
        title = layout["pages"][0]["blocks"][1]
        title.update(x=86, width=1005)
        report.canvas_layout = validate_layout(layout)
        report.save(update_fields=["canvas_layout"])
        self.stdout.write(f"report={report.pk}; desativado, sem concessões ou envios")
