import assert from 'node:assert/strict';
import {projectPoint, dragView} from '../../teaching/omitted-variable-bias/plot.js';
const view={yaw:.52,pitch:.42,panX:0,panY:0,zoomX:1,zoomY:1};
const bounds={x:4,z:4,y:10,center:2};
const p=(x,z,y,v=view,t=0)=>projectPoint(x,z,y,v,bounds,800,350,t);
// Flattening preserves x and y positions irrespective of omitted z.
const a=p(1,-2,4,view,1),b=p(1,3,4,view,1);
assert.equal(a.x,b.x);assert.equal(a.y,b.y);
// Both camera rotations affect the geometry; y-axis dragging tilts the plot.
const tilt=dragView(view,0,60,'y',true,800,350);
assert.equal(tilt.yaw,view.yaw);assert.notEqual(tilt.pitch,view.pitch);
assert.notEqual(p(1,1,4,tilt).y,p(1,1,4).y);
const turn=dragView(view,60,50,'x',true,800,350);
assert.equal(turn.pitch,view.pitch);assert.notEqual(turn.yaw,view.yaw);
// Dragging each 2D axis changes only the requested screen coordinate.
const panX=dragView(view,80,60,'x',false,800,350),panY=dragView(view,80,35,'y',false,800,350);
assert.equal(panX.panY,0);assert.equal(panY.panX,0);
assert.ok(Math.abs(p(1,0,4,panX,1).x-p(1,0,4,view,1).x-80)<1e-10);
assert.ok(Math.abs(p(1,0,4,panY,1).y-p(1,0,4,view,1).y-35)<1e-10);
// Points, mean surfaces, and axes use one affine projection, preserving error segments.
const u=1.5,lo=p(1,2,4),hi=p(1,2,4+u),mid=p(1,2,4+u/2);
assert.ok(Math.abs(mid.y-(lo.y+hi.y)/2)<1e-10);
assert.equal(mid.x,lo.x);
// Large gestures remain bounded and never mutate the initial view.
const bounded=dragView(view,1e9,-1e9,null,true,800,350);
assert.equal(bounded.yaw,Math.PI);assert.equal(bounded.pitch,1.35);
assert.deepEqual(view,{yaw:.52,pitch:.42,panX:0,panY:0,zoomX:1,zoomY:1});
console.log('Projection, both camera rotations, independent axis dragging, and gesture bounds pass.');
