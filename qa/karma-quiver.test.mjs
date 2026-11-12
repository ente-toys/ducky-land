import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Texture,Sprite} from 'pixi.js';
import {createKarmaQuiver} from '../src/rendering/pixi/karma-quiver.js';
const setup=angle=>{
 const body=new Container(),joint=new Container(),tail=new Container(),wing=new Container();body.addChild(joint,tail,wing);
 const quiver=createKarmaQuiver({spec:{angle},body,bodyPart:{joint},parts:[{role:'tail',joint:tail}]},Texture.WHITE);
 return {body,joint,tail,wing,quiver};
};
test('quiver appears after first pickup and displays at most five seated feathers',()=>{
 const {body,quiver}=setup(180);
 for(const count of [0,1,2,3,4,5,7,0]){
  quiver.update(0,count,true,Math.PI);
  const root=body.children.find(c=>c.label==='Karma feather quiver');
  assert.equal(root.visible,count>0);
  const pouch=root.children.find(c=>c.children?.some(p=>p instanceof Sprite));
  const feathers=pouch.children.filter(p=>p instanceof Sprite);
  assert.equal(feathers.filter(p=>p.visible).length,Math.min(count,5));
  assert(feathers.every(p=>p.y>0),'feather shafts end inside the rim');
 }
 body.destroy({children:true});
});
test('bag keeps its proportions through a turn and sits above the tail, below the near wing',()=>{
 for(const angle of [0,45,90,135,180,225,270,315]){
  const {body,tail,wing,quiver}=setup(angle);
  for(const turn of [0,Math.PI/2-.0001,Math.PI/2+.0001,Math.PI,Math.PI*1.5]){
   quiver.update(0,5,true,turn);
   const pouch=body.children.flatMap(c=>c.children).find(c=>c.children?.some(p=>p instanceof Sprite));
   assert.equal(pouch.scale.x,pouch.scale.y,'no horizontal squash');
  }
  const root=body.children.find(c=>c.label==='Karma feather quiver');
  assert(body.getChildIndex(root)>body.getChildIndex(tail));
  assert(body.getChildIndex(root)<body.getChildIndex(wing));
  body.destroy({children:true});
 }
});
