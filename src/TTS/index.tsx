import { useEffect } from "react";
import AWS from "aws-sdk";
import { createScene, loadCharacter } from './loader/loader'
import { createHost, initializeUX } from "./helpers";
import HOST from "./host/three.js";


const ServiceKey = "";
const ServiceRegion = "eastus";


const renderFn: any[] = [];
const speakers = new Map<string, HOST.HostObject>([
  ['Luke', undefined],
  ['Alien', undefined],
]);




const main = async () => {  
   window.AWS.config.region = 'us-east-1';
  window.AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-east-1:919ea36c-ee5b-4152-a381-e055dc486511',
  });
  // window.AWS.config.userPoolId = 'us-east-1_ldSBpn6FW'
  // window.AWS.config.userPoolWebClientId = '2naj2dc7olq7qb6vqk7s69cb28'
  const polly = new AWS.Polly();
  const presigner = new AWS.Polly.Presigner();
  console.log('presigner: ', presigner);
  
  const initSpeech = async () => {
    
    HOST.aws.TextToSpeechFeature.initializeService(
      polly,
      presigner,
      window.AWS.VERSION
      );
  }


  const { scene, camera, clock } = createScene(renderFn);

  const characterFile1 = './assets/glTF/characters/adult_male/luke/luke.gltf';
  const animationPath1 = './assets/glTF/animations/adult_male';
  const animationFiles = [
      'stand_idle.glb',
      'lipsync.glb',
      'gesture.glb',
      'emote.glb',
      'face_idle.glb',
      'blink.glb',
      'poi.glb',
  ];
  const gestureConfigFile = 'gesture.json';
  const poiConfigFile = 'poi.json';
  const lookJoint1 = 'charjx_c_look';
  const audioAttachJoint1 = 'chardef_c_neckB';
  const voice1 = { regionCode: 'en-us', name: 'en-US-ChristopherNeural' }; 
  const voiceEngine = 'neural'; 

  const { character: character1,
    clips: clips1,
    bindPoseOffset: bindPoseOffset1,
  } = await loadCharacter(
      scene,
      characterFile1,
      animationPath1,
      animationFiles
  );

  const audioAttach1 = character1.getObjectByName(audioAttachJoint1);
  const lookTracker1 = character1.getObjectByName(lookJoint1);
  

  const gestureConfig1 = await fetch(
    `${animationPath1}/${gestureConfigFile}`
).then(response => response.json());

const poiConfig1 = await fetch(
  `${animationPath1}/${poiConfigFile}`
).then(response => response.json());

const [
  idleClips1,
  lipsyncClips1,
  gestureClips1,
  emoteClips1,
  faceClips1,
  blinkClips1,
  poiClips1,
] = clips1;


const host = createHost({
    renderFn,
    character: character1,
    audioAttachJoint: audioAttach1,
    voice: voice1,
    engine: voiceEngine,
    idleClip: idleClips1[0],
    faceIdleClip: faceClips1[0],
    lipsyncClips: lipsyncClips1,
    gestureClips: gestureClips1,
    gestureConfig: gestureConfig1,
    emoteClips: emoteClips1,
    blinkClips: blinkClips1,
    poiClips: poiClips1,
    poiConfig: poiConfig1,
    lookJoint: lookTracker1,
    bindPoseOffset: bindPoseOffset1,
    clock,
    camera,
    scene,
  });

  const onHost1StartSpeech = () => {
    // host2.PointOfInterestFeature.setTarget(lookTracker1);
};


  host.listenTo(
    host.TextToSpeechFeature.EVENTS.play,
    onHost1StartSpeech
  );

  await initSpeech()

  speakers.set('Luke', host);

  try {
    initializeUX(speakers);
  }
  catch (e) {
      console.log("Error", e);
  }

}

export default function TTS() {
  
  useEffect(() => {
    void main()
  }, [])
  
  return (
    <>
      <div>
        <button id="play" className="speechButton">Play</button>
        <button id="pause" className="speechButton">Pause</button>
        <button id="resume" className="speechButton">Resume</button>
        <button id="stop" className="speechButton">Stop</button>
      </div>
    </>
  )
}