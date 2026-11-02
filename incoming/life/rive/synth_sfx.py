"""Original procedural SFX. Python standard library, no sampled material."""
import math, random, wave, struct
from pathlib import Path
SR=24000
DEST=Path(__file__).parent/'web'/'audio';DEST.mkdir(exist_ok=True)
rng=random.Random(412)
def save(name,duration,fn):
    data=[];state=0
    for i in range(round(duration*SR)):
        t=i/SR;state=.6*state+.4*rng.uniform(-1,1)
        data.append(fn(t,state))
    peak=max(abs(v) for v in data) or 1
    with wave.open(str(DEST/(name+'.wav')),'wb') as w:
        w.setparams((1,2,SR,0,'NONE','not compressed'))
        w.writeframes(b''.join(struct.pack('<h',round(v/peak*.7*32767)) for v in data))
# Warm nasal two-syllable duck chirp: banded oscillator and a touch of breath.
def quack(t,n):
    env=sum(math.exp(-((t-a)/b)**2) for a,b in [(0.065,.037),(.19,.048)])
    phase=2*math.pi*(390*t-235*t*t)
    return env*(.46*math.sin(phase)+.27*math.sin(phase*3)+.14*math.sin(phase*5)+.06*n)
save('quack',.33,quack)
save('pop',.16,lambda t,n:math.exp(-t*31)*math.sin(2*math.pi*(740*t-1550*t*t))*min(1,t*650))
save('splash',.37,lambda t,n:(1-math.exp(-t*110))*math.exp(-t*12)*(n*.8+.12*math.sin(2*math.pi*(900*t-700*t*t))))
save('step',.095,lambda t,n:math.exp(-t*61)*min(1,t*1200)*(.65*math.sin(2*math.pi*135*t)+n*.32))
print('Wrote 4 original mono PCM WAVs to',DEST)
