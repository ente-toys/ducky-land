from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'rive/web'
SRC = ROOT / 'incoming/onboard/rive/web'
html = (SRC / 'index.html').read_text()
html = html.replace('<canvas id="plaza"', '<canvas id="world-canvas"')
start = html.index('<nav class="world-controls"')
end = html.index('</nav>', start) + len('</nav>')
html = html[:start] + html[end:]
html = html.replace('<script src="app.js"></script>', '<script src="sounds.js"></script>\n  <script src="game.js"></script>\n  <script type="module" src="integration.js"></script>')
html = html.replace('The plaza is paused.', 'The island is paused.')
html = html.replace('a little plaza', 'a little island')
html = html.replace('A little plaza', 'A little island')
html = html.replace('Come as you are. Or with a traffic cone on your head.', 'Tap a path to walk. Drag to steer. Double tap your Ducky for emotes and photos.')
html = html.replace('Ducky Land plaza','Ducky Land island').replace('in the plaza','on the island')
html = html.replace('</head>', '<link rel="stylesheet" href="integrated.css">\n</head>')
html = html.replace('<div id="toast"', '<dialog id="menu"><h2>Your little island.</h2><p>Tap a path to waddle. Drag to steer. Double tap your Ducky for this menu.</p><div class="menu-grid"><button data-emote="2">Quack</button><button data-emote="3">Dance</button><button data-emote="4">Love</button><button data-emote="5">Laugh</button><button data-emote="6">Wave</button><button data-emote="7">Sleep</button><button data-emote="8">Grumpy</button><button data-emote="9">Party</button></div><div class="menu-grid"><button id="open-photo">Take a photo</button><button id="change-outfit">Change your drip</button><button id="sound-toggle">Sound on</button><button id="close-menu">Back to the island</button></div><p>Keyboard: WASD, Q, E. P takes a photo. Escape opens this menu.</p></dialog>\n<div id="activity-ui" hidden aria-live="polite"><span id="activity-message"></span><button id="activity-accept">Start</button><button id="activity-close">Leave</button></div><p id="error" hidden></p>\n<div id="toast"')
(WEB / 'index.html').write_text(html)
shutil.copy2(SRC / 'style.css', WEB / 'style.css')
shutil.copytree(SRC / 'fonts', WEB / 'fonts', dirs_exist_ok=True)
print('Adapted join and photo markup, no persistent world controls.')
