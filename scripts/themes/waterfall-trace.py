"""Trace the imagegen waterfall using the same Python 3.11/vtracer pipeline as Library."""
import sys,os
sys.path.insert(0,os.path.dirname(__file__))
import importlib.util
spec=importlib.util.spec_from_file_location('trace',os.path.join(os.path.dirname(__file__),'pink-trace.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.OUT=os.path.abspath('public/pixi-art/themes/waterfall/detail')
from PIL import Image
im=Image.open('../concepts/themes/work/waterfall/detail/waterfall-source.png')
m.piece(im,(0,0,*im.size),'ribbonfall',k=14)
