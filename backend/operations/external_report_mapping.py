"""Recover editable Canvas drafts from evidenced legacy fields; never run procedures."""
import copy
import re
from .report_canvas.ports import block, text, layout
from .report_canvas.schema import validate_layout

VERSION=1

def contract(legacy_id, archive):
    entries=[r for r in archive.get("components",[]) if str(r.get("ID_RELATORIO"))==str(legacy_id) and r.get("VISCOMP")!="N"]
    charts=[r for r in archive.get("charts",[]) if str(r.get("ID_RELATORIO"))==str(legacy_id)]
    fields=list(dict.fromkeys(str(r["DATAFIELD"]).strip() for r in entries if r.get("DATAFIELD") and not str(r["DATAFIELD"]).startswith("RET_IMAGEM")))
    for row in charts:
        for key in ("NOME_CAMPO_TEXTO","NOME_CAMPO_VALOR"):
            field=str(row.get(key) or "").strip()
            if field and field not in fields:fields.append(field)
    headers={f:f+"_TITULO" for f in fields if f+"_TITULO" in fields}
    columns=[f for f in fields if not f.endswith("_TITULO")]
    original_order={f:i for i,f in enumerate(columns)}
    def order(f):
        m=re.fullmatch(r"RET_(ANO|MES|DIA)([0-9]+)",f)
        return (1,{"ANO":0,"MES":1,"DIA":2}[m[1]],int(m[2])) if m else (0,original_order[f],0)
    columns.sort(key=order)
    return {"columns":fields[:100],"table_columns":columns[:100],"header_fields":headers,"charts":charts,"evidence":"TBRELATORIO_CONFIGURACAO / TBRELATORIO_GRAFICO, extração 24/10/2026","count":len(entries)}


def draft(report, spec):
    columns=spec.get("table_columns") or spec.get("columns") or []
    if not columns:return None
    result=layout(1600,1000);result["export_format"]="pdf"
    result["sources"]=[{"id":"dados","type":"report","report_id":report.pk,"label":report.name[:60]}]
    # Each table keeps all fields; wide results are split horizontally, repeating the key.
    groups=[columns] if len(columns)<=18 else [[columns[0],*columns[i:i+16]] for i in range(1,len(columns),16)]
    charts=spec.get("charts",[])
    for index,cols in enumerate(groups):
        blocks=[text(f"title{index}",report.name,32,25,1536,60,25)]
        if index==0 and charts:
            kinds={"BARRAS":"bar","PIZZA":"pie","LINHAS":"line","LINHA":"line"}
            x=charts[0].get("NOME_CAMPO_TEXTO")
            ys=list(dict.fromkeys(r.get("NOME_CAMPO_VALOR") for r in charts if r.get("NOME_CAMPO_TEXTO")==x and r.get("NOME_CAMPO_VALOR")))
            if x and ys and len(ys)<=6:
                blocks.append(block("chart","pie" if kinds.get(charts[0].get("TIPO_SERIES"))=="pie" else kinds.get(charts[0].get("TIPO_SERIES"),"bar"),32,105,1536,340,source="dados",x_field=x,y_fields=ys))
        has_chart=len(blocks)>1
        opt={"columns":cols,"font_size":9 if len(cols)>10 else 12,"header_fields":{k:v for k,v in spec.get("header_fields",{}).items() if k in cols}}
        blocks.append(block(f"table{index}","table",32,465 if has_chart else 110,1536,485 if has_chart else 830,source="dados",**opt))
        result["pages"].append({"id":f"p{index+1}","name":report.name[:90]+(f" {index+1}" if len(groups)>1 else ""),"blocks":blocks})
    return validate_layout(result)


def compose(report, children):
    result=layout(1600,1000);result["export_format"]="pdf"
    for child in children:
        value=child.canvas_layout
        if not value:return None,"Componente sem modelo Canvas: "+child.code
        prefix="r"+str(child.pk)+"_"
        for source in value["sources"]:
            s=copy.deepcopy(source);s["id"]=prefix+s["id"];result["sources"].append(s)
        for page in value["pages"]:
            p=copy.deepcopy(page);p["id"]=prefix+p["id"]
            for b in p["blocks"]:
                b["id"]=prefix+b["id"]
                if b.get("source_id"):b["source_id"]=prefix+b["source_id"]
            result["pages"].append(p)
    if len(result["sources"])>30 or len(result["pages"])>30 or sum(len(p["blocks"]) for p in result["pages"])>100:
        return None,"Composição excede limites atuais do Canvas (30 fontes/30 páginas/100 blocos); componentes completos preservados separadamente."
    return validate_layout(result),""


def catalog_contract(report):
    value=report.legacy.get("external_mapping",{})
    columns=value.get("columns",[])
    if not columns or len(columns)>100 or any(not isinstance(c,str) or not c or len(c)>100 for c in columns) or len(set(columns))!=len(columns):return None
    return {"id":report.pk,"name":report.name,"code":report.code,"columns":columns,"available":False,"unavailable_reason":value.get("blocker") or "Fonte mapeada; consulta e cálculo ainda não homologados."}
