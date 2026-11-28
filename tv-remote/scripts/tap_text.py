# usage: tap_text.py "نص" -> يطبع إحداثيات مركز العنصر الذي يحتوي النص من ui.xml
import re, sys, xml.etree.ElementTree as ET
t = ET.parse('ui.xml')
for n in t.iter('node'):
    if sys.argv[1] in (n.get('text') or '') + (n.get('content-desc') or ''):
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
        print((x1 + x2) // 2, (y1 + y2) // 2); sys.exit(0)
sys.exit(1)
