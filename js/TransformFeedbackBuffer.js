import {GLObject} from "./GLObject.js";
import {Shader} from "./Shader.js";
import {VertexArrayObject} from "./VertexArrayObject.js";
import {TransformFeedback} from "./TransformFeedback.js";

export class TransformFeedbackBuffer extends GLObject {
    shader;
    uniforms;
    attributes;
    vertexArrayObject;
    drawCount;
    transformFeedback;

    // outputs;

    constructor({gpu, attributes, varyings, vertexShader, fragmentShader, uniforms, drawCount}) {
        super();

        const gl = gpu.gl;

        const transformFeedbackVaryings = varyings.map(({name}) => name);

        this.shader = new Shader({gpu, vertexShader, fragmentShader, transformFeedbackVaryings});
        this.uniforms = uniforms;
        this.drawCount = drawCount;

        attributes.forEach((attribute, i) => {
            attribute.location = i;
            attribute.divisor = 0;
        });

        this.attributes = attributes;

        this.vertexArrayObject = new VertexArrayObject({
            gpu,
            attributes: attributes,
        });

        // this.outputs = [];

        const outputBuffers = varyings.map(({name, data}) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            // this.outputs.push({
            //     buffer
            // })
            return {name, buffer};
        });

        const transformFeedback = new TransformFeedback({
            gpu,
            buffers: outputBuffers
        });

        this.transformFeedback = transformFeedback;
    }
}
