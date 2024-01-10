import * as THREE from 'three'
import HOST from './host/three.js';
import HostObject from './host/three.js/HostObject.js';

interface ICreateHost {
    renderFn: any[]
    character: THREE.Group;
    audioAttachJoint: THREE.Object3D | undefined;
    voice: string,
    engine: string;
    idleClip: THREE.AnimationClip;
    faceIdleClip: THREE.AnimationClip;
    lipsyncClips: THREE.AnimationClip[];
    gestureClips: THREE.AnimationClip[];
    gestureConfig: any;
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
    const host: any = new HostObject({ owner: character, clock });
    
    renderFn.push(() => {
        host.update();
    });

    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    
    audioListener.setMasterVolume(6)
    
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
    const talkClip = lipsyncClips.find(c => c.name === 'stand_talk') as THREE.AnimationClip;
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
            config.queueOptions.forEach((option: any) => {
                console.log('option: ', option);
                
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

    // window.lipsyncClips = lipsyncClips;

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
    poiConfig.forEach((config: any) => {
        host.AnimationFeature.addLayer(config.name, {
            blendMode: HOST.anim.LayerBlendModes.Additive,
        });

        // Find each pose clip and make it additive
        config.blendStateOptions.forEach((clipConfig: any) => {
            console.log('clipConfig: ', clipConfig);
            
            const clip = poiClips.find(clip => clip.name === clipConfig.clip) as THREE.AnimationClip ;
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
