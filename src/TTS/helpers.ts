import * as THREE from 'three'
import HOST from './host/threeAzure';

interface IVoice {
    regionCode: string;
    name: string;
}

interface ICreateHost {
    renderFn: any[]
    character: THREE.Group;
    audioAttachJoint: THREE.Object3D | undefined;
    voice: IVoice,
    engine: string;
    idleClip: THREE.AnimationClip;
    faceIdleClip: THREE.AnimationClip;
    lipsyncClips: THREE.AnimationClip[];
    gestureClips: THREE.AnimationClip[];
    gestureConfig: object;
    emoteClips: THREE.AnimationClip[];
    blinkClips: THREE.AnimationClip[];
    poiClips: THREE.AnimationClip[];
    poiConfig: object[];
    lookJoint: THREE.Object3D | undefined;
    bindPoseOffset: THREE.AnimationClip;
    clock: THREE.Clock;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
}
// Initialize the host
export const createHost = (
    {
    renderFn,
    character,
    audioAttachJoint,
    voice,
    engine,
    idleClip,
    faceIdleClip,
    lipsyncClips,
    gestureClips,
    gestureConfig,
    emoteClips,
    blinkClips,
    poiClips,
    poiConfig,
    lookJoint,
    bindPoseOffset,
    clock,
    camera,
    scene
    } : ICreateHost
) => {
    const host = new HOST.HostObject({ owner: character, clock });
    
    renderFn.push(() => {
        host.update();
        if (host.visemeHandler) {
            host.visemeHandler.CheckForViseme();
        }
    });

    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    host.addFeature(HOST.aws.TextToSpeechFeature, false, {
        listener: audioListener,
        attachTo: audioAttachJoint,
        voice,
        engine,
    });

    // Set up animation
    host.addFeature(HOST.anim.AnimationFeature);

    // Base idle
    host.AnimationFeature.addLayer('Base');
    host.AnimationFeature.addAnimation(
        'Base',
        idleClip.name,
        HOST.anim.AnimationTypes.single,
        { clip: idleClip }
    );
    host.AnimationFeature.playAnimation('Base', idleClip.name);
    
    // Face idle
    host.AnimationFeature.addLayer('Face', {
        blendMode: HOST.anim.LayerBlendModes.Additive,
    });
    THREE.AnimationUtils.makeClipAdditive(faceIdleClip);
    host.AnimationFeature.addAnimation(
        'Face',
        faceIdleClip.name,
        HOST.anim.AnimationTypes.single,
        {
            clip: THREE.AnimationUtils.subclip(
                faceIdleClip,
                faceIdleClip.name,
                1,
                faceIdleClip.duration * 30,
                30
            ),
        }
    );
    host.AnimationFeature.playAnimation('Face', faceIdleClip.name);

    // Blink
    host.AnimationFeature.addLayer('Blink', {
        blendMode: HOST.anim.LayerBlendModes.Additive,
        transitionTime: 0.075,
    });
    blinkClips.forEach(clip => {
        THREE.AnimationUtils.makeClipAdditive(clip);
    });
    host.AnimationFeature.addAnimation(
        'Blink',
        'blink',
        HOST.anim.AnimationTypes.randomAnimation,
        {
            playInterval: 3,
            subStateOptions: blinkClips.map(clip => {
                return {
                    name: clip.name,
                    loopCount: 1,
                    clip,
                };
            }),
        }
    );
    host.AnimationFeature.playAnimation('Blink', 'blink');

    // Talking idle
    host.AnimationFeature.addLayer('Talk', {
        transitionTime: 0.75,
        blendMode: HOST.anim.LayerBlendModes.Additive,
    });
    host.AnimationFeature.setLayerWeight('Talk', 0);
    const talkClip = lipsyncClips.find(c => c.name === 'stand_talk');
    lipsyncClips.splice(lipsyncClips.indexOf(talkClip), 1);
    host.AnimationFeature.addAnimation(
        'Talk',
        talkClip.name,
        HOST.anim.AnimationTypes.single,
        { clip: THREE.AnimationUtils.makeClipAdditive(talkClip) }
    );
    host.AnimationFeature.playAnimation('Talk', talkClip.name);

    // Gesture animations
    host.AnimationFeature.addLayer('Gesture', {
        transitionTime: 0.5,
        blendMode: HOST.anim.LayerBlendModes.Additive,
    });
    gestureClips.forEach(clip => {
        const { name } = clip;
        const config = gestureConfig[name];
        THREE.AnimationUtils.makeClipAdditive(clip);

        if (config !== undefined) {
            config.queueOptions.forEach((option, index) => {
                // Create a subclip for each range in queueOptions
                option.clip = THREE.AnimationUtils.subclip(
                    clip,
                    `${name}_${option.name}`,
                    option.from,
                    option.to,
                    30
                );
            });
            host.AnimationFeature.addAnimation(
                'Gesture',
                name,
                HOST.anim.AnimationTypes.queue,
                config
            );
        } else {
            host.AnimationFeature.addAnimation(
                'Gesture',
                name,
                HOST.anim.AnimationTypes.single,
                { clip }
            );
        }
    });

    // Emote animations
    host.AnimationFeature.addLayer('Emote', {
        transitionTime: 0.5,
    });

    emoteClips.forEach(clip => {
        const { name } = clip;
        host.AnimationFeature.addAnimation(
            'Emote',
            name,
            HOST.anim.AnimationTypes.single,
            { clip, loopCount: 1 }
        );
    });

    // Viseme poses
    host.AnimationFeature.addLayer('Viseme', {
        transitionTime: 0.12,
        blendMode: HOST.anim.LayerBlendModes.Additive,
    });
    host.AnimationFeature.setLayerWeight('Viseme', 0);

    window.lipsyncClips = lipsyncClips;

    // Slice off the reference frame
    const blendStateOptions = lipsyncClips.map(clip => {
        THREE.AnimationUtils.makeClipAdditive(clip);
        return {
            name: clip.name,
            clip: THREE.AnimationUtils.subclip(clip, clip.name, 1, 2, 30),
            weight: 0,
        };
    });

    host.AnimationFeature.addAnimation(
        'Viseme',
        'visemes',
        HOST.anim.AnimationTypes.freeBlend,
        { blendStateOptions }
    );

    host.AnimationFeature.playAnimation('Viseme', 'visemes');

    // POI poses
    poiConfig.forEach(config => {
        host.AnimationFeature.addLayer(config.name, {
            blendMode: HOST.anim.LayerBlendModes.Additive,
        });

        // Find each pose clip and make it additive
        config.blendStateOptions.forEach(clipConfig => {
            const clip = poiClips.find(clip => clip.name === clipConfig.clip);
            THREE.AnimationUtils.makeClipAdditive(clip);
            clipConfig.clip = THREE.AnimationUtils.subclip(
                clip,
                clip.name,
                1,
                2,
                30
            );
        });

        host.AnimationFeature.addAnimation(
            config.name,
            config.animation,
            HOST.anim.AnimationTypes.blend2d,
            { ...config }
        );

        host.AnimationFeature.playAnimation(config.name, config.animation);

        // Find and store reference objects
        config.reference = character.getObjectByName(
            config.reference.replace(':', '')
        );
    });

    // Apply bindPoseOffset clip if it exists
    if (bindPoseOffset !== undefined) {

        host.AnimationFeature.addLayer('BindPoseOffset', {
            blendMode: HOST.anim.LayerBlendModes.Additive,
        });

        host.AnimationFeature.addAnimation(
            'BindPoseOffset',
            bindPoseOffset.name,
            HOST.anim.AnimationTypes.single,
            {
                clip: THREE.AnimationUtils.subclip(
                    bindPoseOffset,
                    bindPoseOffset.name,
                    1,
                    2,
                    30
                ),
            }
        );

        host.AnimationFeature.playAnimation(
            'BindPoseOffset',
            bindPoseOffset.name
        );
    }

    // Set up Lipsync
    const visemeOptions = {
        layers: [{ name: 'Viseme', animation: 'visemes' }],
    };

    const talkingOptions = {
        layers: [
            {
                name: 'Talk',
                animation: 'stand_talk',
                blendTime: 0.75,
                easingFn: HOST.anim.Easing.Quadratic.InOut,
            },
        ],
    };

    host.addFeature(
        HOST.LipsyncFeature,
        false,
        visemeOptions,
        talkingOptions
    );

    // Set up Gestures
    host.addFeature(HOST.GestureFeature, false, {
        layers: {
            Gesture: { minimumInterval: 3 },
            Emote: {
                blendTime: 0.5,
                easingFn: HOST.anim.Easing.Quadratic.InOut,
            },
        },
    });

    // Set up Point of Interest
    host.addFeature(
        HOST.PointOfInterestFeature,
        false,
        {
            target: camera,
            lookTracker: lookJoint,
            scene,
        },
        {
            layers: poiConfig,
        },
        {
            layers: [{ name: 'Blink' }],
        }
    );

    host.audioListener = audioListener;

    return host;
}

const enableDragDrop = (className: string) => {
    const elements = document.getElementsByClassName(className);

    for (let i = 0, l = elements.length; i < l; i += 1) {
      const dropArea = elements[i];

      // Copy contents of files into the text input once they are read
      const fileReader = new FileReader();
      fileReader.onload = evt => {
        dropArea.value = evt.target.result;
      };

      // Drag and drop listeners
      dropArea.addEventListener('dragover', evt => {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
      });

      dropArea.addEventListener('drop', evt => {
        evt.stopPropagation();
        evt.preventDefault();

        // Read the first file that was dropped
        const [file] = evt.dataTransfer.files;
        fileReader.readAsText(file, 'UTF-8');
      });
    }
  }

  function getCurrentHost(speakers: Map<string, HOST.HostObject>) {

    return {name: "Luke", host: speakers.get("Luke")};
  }

export const initializeUX =  (speakers: Map<string, HOST.HostObject>) => {
    // Enable drag/drop text files on the speech text area
    enableDragDrop('textEntry');

    // Connect tab buttons to hosts
    Array.from(document.getElementsByClassName('tab')).forEach(tab => {
      tab.onclick = evt => { toggleHost(evt); }
    });

    // Play, pause, resume and stop the contents of the text input as speech
    // when buttons are clicked
    ['play'].forEach(id => {
      const button = document.getElementById(id) as HTMLElement ;
      button.onclick = () => {
        const {name, host} = getCurrentHost(speakers);        
        const speechInput = `Most of the consonant visemes are not properly captured. All the "p", "b", "n", "m" etc sounds where the lips are supposed to touch dont have a good representation in the viseme data.
        Some values are way too high or too low throughout the whole list of viseme events, resulting in an animation with less realistic.
        Responses data need to mapping with blendshape keys of Model glb(Ready player me) by name 
        `;

        host.TextToSpeechFeature[id](speechInput);
      };
    });

  }