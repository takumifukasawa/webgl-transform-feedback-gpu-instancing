import {GLObject} from "./GLObject.js";
import {Shader} from "./Shader.js";
import {VertexArrayObject} from "./VertexArrayObject.js";
import {TransformFeedback} from "./TransformFeedback.js";

export class TransformFeedbackDoubleBuffer extends GLObject {
    shader;
    uniforms;
    buffers;
    drawCount;

    get read() {
        const buffer = this.buffers[0];
        return {
            vertexArrayObject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }

    get write() {
        const buffer = this.buffers[0];
        return {
            vertexArrayObject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }

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

        const attributes1 = attributes;
        const attributes2 = attributes.map(attribute => ({...attribute}));

        const vertexArrayObject1 = new VertexArrayObject({
            gpu,
            attributes: attributes1,
        });
        const vertexArrayObject2 = new VertexArrayObject({
            gpu,
            attributes: attributes2,
        });

        // console.log(attributes1, attributes2, vertexArrayObject1.getBuffers(), vertexArrayObject2.getBuffers())
        
        // const outputBuffers1 = varyings.map(({name, data}) => {
        //     const buffer = gl.createBuffer();
        //     gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        //     gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        //     gl.bindBuffer(gl.ARRAY_BUFFER, null);
        //     return {name, buffer};
        // });

        // const outputBuffers2 = varyings.map(({name, data}) => {
        //     const buffer = gl.createBuffer();
        //     gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        //     gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        //     gl.bindBuffer(gl.ARRAY_BUFFER, null);
        //     return {name, buffer};
        // });

        const transformFeedback1 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject1.getBuffers()
            // buffers: outputBuffers1
        });
        const transformFeedback2 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject2.getBuffers()
            // buffers: outputBuffers2
        });

        this.buffers = [
            {
                attributes: attributes1,
                srcVertexArrayObject: vertexArrayObject1,
                transformFeedback: transformFeedback2,
                outputVertexArrayObject: vertexArrayObject2,
            },
            {
                attributes: attributes2,
                srcVertexArrayObject: vertexArrayObject2,
                transformFeedback: transformFeedback1,
                outputVertexArrayObject: vertexArrayObject1,
            },
        ];
    }

    swap() {
        this.buffers.reverse();
    }
}
