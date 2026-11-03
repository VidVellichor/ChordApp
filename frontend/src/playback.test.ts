import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTrack, acceptsAudio, formatTime, releaseTracks } from './playback.ts';
test('queue respects boundaries, repeat and shuffle',()=>{
 assert.equal(nextTrack(['a','b'],'a',1,'off',false),'b');
 assert.equal(nextTrack(['a','b'],'b',1,'off',false,true),null);
 assert.equal(nextTrack(['a','b'],'b',1,'all',false,true),'a');
 assert.equal(nextTrack(['a','b'],'b',1,'one',false,true),'b');
 assert.equal(nextTrack(['a','b'],'a',1,'off',true,false,()=>0),'b');
 assert.equal(nextTrack([],null,1,'all',true),null);
});
test('audio validation, time and object URL cleanup',()=>{
 assert.equal(acceptsAudio({name:'song.mp3',type:'',size:10}),true);
 assert.equal(acceptsAudio({name:'song.mp3',type:'audio/mpeg',size:0}),false);
 assert.equal(acceptsAudio({name:'file.txt',type:'text/plain',size:10}),false);
 assert.equal(formatTime(NaN),'0:00');assert.equal(formatTime(125),'2:05');
 const revoked:string[]=[];releaseTracks([{id:'1',title:'a',filename:'a',url:'blob:a',size:1}],url=>revoked.push(url));assert.deepEqual(revoked,['blob:a']);
});

