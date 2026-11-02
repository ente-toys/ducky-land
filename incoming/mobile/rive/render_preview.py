# render_preview.py: per-frame headless renders of preview segments -> preview/ducky-step1.mp4 (30 fps)
import subprocess, os
from concurrent.futures import ThreadPoolExecutor
os.chdir(os.path.dirname(os.path.abspath(__file__)))
SEG = [  # (action, seconds, data)
    (0, 1.4, ''), (1, 1.6, 'cap=8 shoes=1'), (2, 1.3, 'cap=2 shades=1 acc=7 shoes=3'),
    (3, 1.6, 'cap=11 shades=2 acc=2 shoes=9'),
    (0, 0.4, 'cap=1 acc=3'), (0, 0.4, 'cap=6 shades=3 shoes=4'), (0, 0.4, 'cap=9 acc=1 shoes=6'), (0, 0.4, 'cap=12 shades=1 acc=4 shoes=10'),
    (3, 1.4, 'cap=13 acc=5 shoes=5'),
]
jobs = []; n = 0
for a, sec, d in SEG:
    for k in range(int(sec * 30)):
        jobs.append((n, a, 1 + 2 * k, d)); n += 1
def run(j):
    i, a, adv, d = j
    subprocess.run(['rive', '.', f'--screenshot=preview/frames/f{i:04d}.png', f'--advance={adv}', '--data=bg=1', f'--data=action={a}'] + ['--data=' + x for x in d.split()], capture_output=True)
with ThreadPoolExecutor(6) as ex: list(ex.map(run, jobs))
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-i', 'preview/frames/f%04d.png', '-vf', 'scale=712:936,format=yuv420p', '-c:v', 'libx264', '-crf', '18', 'preview/ducky-step1.mp4'])
print(n, 'frames')
