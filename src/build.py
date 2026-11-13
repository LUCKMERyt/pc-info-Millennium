# Builds ../.millennium/Dist/webkit.js from pcinfo-core.js + pcinfo-hw.js
# (ASCII only: every non-ASCII character is written as a UTF-16 \uXXXX escape).
# Usage: python3 build.py
import os
here = os.path.dirname(os.path.abspath(__file__))
core = open(os.path.join(here, 'pcinfo-core.js'), encoding='utf8').read()
hw = open(os.path.join(here, 'pcinfo-hw.js'), encoding='utf8').read()
assert core.count('/*__HW__*/') == 1
out = core.replace('/*__HW__*/', hw)

def esc(t):
    r = []
    for ch in t:
        o = ord(ch)
        if o < 127:
            r.append(ch)
        elif o > 0xFFFF:
            o -= 0x10000
            r.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
        else:
            r.append('\\u%04x' % o)
    return ''.join(r)

res = esc(out)
assert '/*__DATA__*/null' in res          # placeholder that pc-info.ps1 fills with the detected specs
dest = os.path.join(here, '..', '.millennium', 'Dist', 'webkit.js')
open(dest, 'w', encoding='ascii').write(res)
print('written', dest, len(res))
