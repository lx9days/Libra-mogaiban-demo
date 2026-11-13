from pathlib import Path
import copy
import re
import xml.etree.ElementTree as ET

folder = Path(__file__).parent
ET.register_namespace('', 'http://www.w3.org/2000/svg')
root = ET.parse(folder / 'static-source.svg').getroot()
root.set('viewBox', '0 0 500 380')
root.set('font-family', 'Segoe UI, sans-serif')
root.set('color', '#10233f')
for element in root.iter():
    style = element.get('style', '')
    match = re.search(r'transform:\s*translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*rotate\(([-\d.]+)deg\)', style)
    if match:
        x, y, angle = match.groups()
        element.set('transform', f'translate({x},{y}) rotate({angle})')
        element.attrib.pop('style', None)

points = copy.deepcopy(root)
def keep_points(element):
    if element.tag.endswith('defs') or element.tag.endswith('clipPath'):
        return True
    if 'mark' in element.get('class', '').split():
        return True
    for child in list(element):
        if not keep_points(child):
            element.remove(child)
    return len(element) > 0
keep_points(points)

other = copy.deepcopy(root)
for parent in other.iter():
    for child in list(parent):
        if 'mark' in child.get('class', '').split():
            parent.remove(child)

for name, tree in [('scatter-points', points), ('axes-and-legend', other)]:
    ET.ElementTree(tree).write(folder / f'{name}.svg', encoding='utf-8', xml_declaration=True)
    print(name, 'circles:', sum(e.tag.endswith('circle') for e in tree.iter()))
