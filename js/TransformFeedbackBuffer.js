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

    constructor({gpu, attributes, transformFeedbackVaryings, vertexShader, fragmentShader, uniforms, drawCount}) {
        super();

        const gl = gpu.gl;

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

        const outputBuffers = transformFeedbackVaryings.map(({data}) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            return buffer;
        });

        const transformFeedback = new TransformFeedback({
            gpu,
            buffers: outputBuffers
        });

    }
}
