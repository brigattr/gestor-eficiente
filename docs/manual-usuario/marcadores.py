# Corrige títulos duplicados nos marcadores ("SumárioSumário" → "Sumário") gerados pelo Chromium.
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject
src, dst = sys.argv[1], sys.argv[2]
w = PdfWriter(clone_from=PdfReader(src))
def fix(item):
    while item is not None:
        o = item.get_object()
        t = str(o.get('/Title', ''))
        h = len(t) // 2
        if len(t) % 2 == 0 and t[:h] == t[h:]:
            o[NameObject('/Title')] = TextStringObject(t[:h])
        if '/First' in o: fix(o['/First'])
        item = o.get('/Next')
root = w._root_object
if '/Outlines' in root and '/First' in root['/Outlines'].get_object(): fix(root['/Outlines'].get_object()['/First'])
w.add_metadata({'/Title': sys.argv[3], '/Author': 'ChiefDesk', '/Subject': 'Gestor Eficiente'})
w.compress_identical_objects() if hasattr(w, 'compress_identical_objects') else None
with open(dst, 'wb') as fh: w.write(fh)
