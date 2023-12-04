import {AttributeUsageTypes, UniformTypes, TextureTypes} from "./js/constants.js";
import {Matrix4} from "./js/Matrix4.js";
import {Vector3} from "./js/Vector3.js";
import {GPU} from "./js/GPU.js";
import {VertexArrayObject} from "./js/VertexArrayObject.js";
import {Shader} from "./js/Shader.js";

const wrapperElement = document.getElementById("js-wrapper")
const canvasElement = document.getElementById("js-canvas");
const gl = canvasElement.getContext("webgl2", {antialias: false});

// const pixelRatio = Math.min(window.devicePixelRatio, 1.5);

const gpu = new GPU({gl});

// ----------------------------------------------------------------------------------
// functions
// ----------------------------------------------------------------------------------

const createBoxGeometry = () => {
    // -----------------------------
    //   6 ---- 4
    //  /|     /|
    // 0 ---- 2 |
    // | 7 -- | 5
    // |/     |/
    // 1 ---- 3
    // -----------------------------

    const boxPosition_0 = [-0.5, 0.5, 0.5];
    const boxPosition_1 = [-0.5, -0.5, 0.5];
    const boxPosition_2 = [0.5, 0.5, 0.5];
    const boxPosition_3 = [0.5, -0.5, 0.5];
    const boxPosition_4 = [0.5, 0.5, -0.5];
    const boxPosition_5 = [0.5, -0.5, -0.5];
    const boxPosition_6 = [-0.5, 0.5, -0.5];
    const boxPosition_7 = [-0.5, -0.5, -0.5];

    const normalsRaw = [
        [0, 0, 1], // front
        [1, 0, 0], // right
        [0, 0, -1], // back
        [-1, 0, 0], // left
        [0, 1, 0], // top
        [0, -1, 0], // bottom
    ];

    const positions = [
        // front
        ...boxPosition_0,
        ...boxPosition_1,
        ...boxPosition_2,
        ...boxPosition_3,
        // right
        ...boxPosition_2,
        ...boxPosition_3,
        ...boxPosition_4,
        ...boxPosition_5,
        // back
        ...boxPosition_4,
        ...boxPosition_5,
        ...boxPosition_6,
        ...boxPosition_7,
        // left
        ...boxPosition_6,
        ...boxPosition_7,
        ...boxPosition_0,
        ...boxPosition_1,
        // top
        ...boxPosition_6,
        ...boxPosition_0,
        ...boxPosition_4,
        ...boxPosition_2,
        // bottom
        ...boxPosition_1,
        ...boxPosition_7,
        ...boxPosition_3,
        ...boxPosition_5,
    ];
    const uvs = new Array(6)
        .fill(0)
        .map(() => [0, 1, 0, 0, 1, 1, 1, 0])
        .flat();
    const normals = normalsRaw.map((normal) => new Array(4).fill(0).map(() => normal)).flat(2);

    const indices = Array.from(Array(6).keys())
        .map((i) => [i * 4 + 0, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3])
        .flat();

    return {
        positions,
        uvs,
        normals,
        indices,
    };
}


const createShader = () => {
    return new Shader({
        gpu,
        vertexShader: `#version 300 es
    
layout (location = 0) in vec3 aPosition;   
layout (location = 1) in vec3 aNormal;   
// layout (location = 1) in vec3 aColor; 

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// out vec3 vColor;
out vec3 vNormal;
out vec4 vWorldPosition;

void main() {
    vNormal = aNormal;
    // vColor = aColor;
   
    vec4 worldPosition = uWorldMatrix * vec4(aPosition, 1.); 
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
    `,
        fragmentShader: `#version 300 es
precision mediump float;
in vec3 vNormal;
in vec4 vWorldPosition;
out vec4 outColor;
void main() {
    vec3 lightDir = normalize(vec3(1., 1., 1.));
    vec3 normal = normalize(vNormal);
    float diffuse = (dot(lightDir, normal) + 1.) * .5;
    outColor = vec4(vec3(diffuse), 1.);
}
    `
    });
}

// ----------------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------------

const main = () => {
    const targetCameraPosition = new Vector3(0, 0, 8);

    let width;
    let height;

    const boxGeometryData = createBoxGeometry();
    const geometry = new VertexArrayObject({
        gpu,
        attributes: {
            position: {
                data: new Float32Array(boxGeometryData.positions),
                size: 3,
                location: 0,
            },
            normal: {
                data: new Float32Array(boxGeometryData.normals),
                size: 3,
                location: 1,
            },
            // color: {
            //     data: new Float32Array(boxGeometryData.normals),
            //     size: 3,
            //     location: 1,
            // },
        },
        indices: boxGeometryData.indices
    });

    const shader = createShader();

    const uniforms = {
        uProjectionMatrix: {
            type: UniformTypes.Matrix4,
            value: Matrix4.identity()
        },
        uViewMatrix: {
            type: UniformTypes.Matrix4,
            value: Matrix4.identity()
        },
        uWorldMatrix: {
            type: UniformTypes.Matrix4,
            value: Matrix4.identity()
        },
    };

    const onMouseMove = (e) => {
        const nx = (e.clientX / width) * 2 - 1;
        const ny = (e.clientY / height) * 2 - 1;
        targetCameraPosition.x = nx * 4;
        targetCameraPosition.y = -ny * 4 + 2;
    };

    const onWindowResize = () => {
        width = wrapperElement.offsetWidth;
        height = wrapperElement.offsetHeight;

        canvasElement.width = width;
        canvasElement.height = height;

        gpu.setSize(0, 0, width, height);

        const fov = 60;
        const aspect = width / height;
        const near = 1;
        const far = 20;
        const projectionMatrix = Matrix4.getPerspectiveMatrix(fov * Math.PI / 180, aspect, near, far);
        uniforms.uProjectionMatrix.value = projectionMatrix;
    };

    const tick = (time) => {
        const cameraLookAtPosition = new Vector3(0, 0, 0);
        const cameraWorldMatrix = Matrix4.getLookAtMatrix(
            targetCameraPosition,
            cameraLookAtPosition,
            Vector3.up(),
            true
        );
        uniforms.uViewMatrix.value = cameraWorldMatrix.invert();

        gpu.clear(0, 0, 0, 1);

        gpu.setVertexArrayObject(geometry);
        gpu.setShader(shader);
        gpu.setUniforms(uniforms);

        const drawCount = geometry.indices.length;
        gpu.draw({drawCount});

        gpu.flush();

        requestAnimationFrame(tick);
    };

    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    requestAnimationFrame(tick);
};

main();
