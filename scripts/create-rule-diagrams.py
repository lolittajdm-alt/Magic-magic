from pathlib import Path

assets = Path(__file__).resolve().parents[1] / 'public' / 'assets'

def ball(x, y, r=9):
    return f'<circle cx="{x}" cy="{y+2}" r="{r}" fill="#512d1c" opacity=".18"/><circle cx="{x}" cy="{y}" r="{r}" fill="url(#ball)"/><ellipse cx="{x-r*.28}" cy="{y-r*.35}" rx="{r*.3}" ry="{r*.2}" fill="#fff" opacity=".65"/>'

for step in range(1, 5):
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 330">
    <defs>
      <linearGradient id="wood" x2=".8" y2="1"><stop stop-color="#ffd99c"/><stop offset="1" stop-color="#dc913b"/></linearGradient>
      <radialGradient id="ball" cx=".32" cy=".25" r=".75"><stop stop-color="#7f98a0"/><stop offset=".35" stop-color="#26353c"/><stop offset="1" stop-color="#080d11"/></radialGradient>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="#57951f" stroke-width="2"/></marker>
    </defs>
    <rect width="480" height="330" rx="24" fill="#edf4e6"/>
    <circle cx="455" cy="20" r="115" fill="#e1edce"/>
    <circle cx="24" cy="330" r="94" fill="#e5efdc"/>
    <rect x="106" y="54" width="268" height="256" rx="22" fill="#54713a" opacity=".12"/>
    <rect x="102" y="43" width="276" height="256" rx="21" fill="#b9742e"/>
    <rect x="102" y="37" width="276" height="256" rx="21" fill="url(#wood)" stroke="#cb8838" stroke-width="2"/>
    <rect x="128" y="49" width="224" height="16" rx="8" fill="#a25e26" opacity=".6"/>
    <rect x="128" y="265" width="224" height="16" rx="8" fill="#a25e26" opacity=".6"/>
    '''
    for row in range(8):
        for col in range(8):
            x, y = 145 + col * 27, 82 + row * 24
            svg += f'<ellipse cx="{x}" cy="{y}" rx="8" ry="7" fill="#b97532" opacity=".65"/><path d="M{x-6} {y+4} Q{x} {y+9} {x+6} {y+4}" fill="none" stroke="#ffe1a3" stroke-width="1.5"/>'
    if step == 1:
        for row in range(8):
            for col in range(2):
                svg += ball(43+col*24, 74+row*25)
                svg += ball(413+col*24, 74+row*25)
        for x in (55, 425):
            svg += f'<text x="{x}" y="304" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="700" fill="#45692e">16</text>'
    elif step == 2:
        for x, y in [(145,82),(226,106),(307,130),(172,178),(280,226)]:
            svg += ball(x,y)
        svg += '<circle cx="253" cy="178" r="14" fill="none" stroke="#57951f" stroke-width="3" stroke-dasharray="4 4"/><path d="M417 177 Q378 151 276 174" stroke="#57951f" stroke-width="4" fill="none" marker-end="url(#arrow)"/>'
        svg += ball(425, 179, 14)
    elif step == 3:
        svg += '<ellipse cx="240" cy="166" rx="78" ry="62" fill="#cce8ee" opacity=".7"/><ellipse cx="240" cy="166" rx="64" ry="49" fill="none" stroke="#8dc6d1" stroke-width="2"/>'
        for x,y in [(219,148),(239,143),(259,151),(208,168),(229,166),(250,171),(270,171),(222,187),(245,191)]:
            svg += ball(x,y,12)
        svg += '<path d="M300 186 Q354 196 401 256" stroke="#57951f" stroke-width="4" fill="none" marker-end="url(#arrow)"/>'
        for x,y in [(403,281),(427,283),(415,263)]:
            svg += ball(x,y,11)
    else:
        for x,y in [(145,82),(226,106),(307,130),(172,178),(280,226),(334,202),(199,250)]:
            svg += ball(x,y)
        svg += '<circle cx="365" cy="91" r="39" fill="#57951f" stroke="#fffefa" stroke-width="5"/><path d="m346 91 13 13 25-28" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="146" y="266" width="187" height="14" rx="7" fill="#eff6df"/><text x="240" y="278" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#45692e">0 МАГНІТІВ — ПЕРЕМОГА!</text>'
    svg += f'<circle cx="30" cy="28" r="19" fill="#294b42"/><text x="30" y="35" text-anchor="middle" font-family="sans-serif" font-size="21" font-weight="700" fill="white">{step}</text></svg>'
    (assets / f'rule-{step}.svg').write_text(svg)
