import {GLObject} from "./GLObject.js";
import {Shader} from "./Shader.js";
import {VertexArrayObject} from "./VertexArrayObject.js";
import {TransformFeedback} from "./TransformFeedback.js";

export class TransformFeedbackDoubleBuffer extends GLObject {
    shader;
    uniforms;
    buffers;
    
    get read() {
        const buffer = this.buffers[0];
        return {
            vertexArrayobject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }
    
    get write() {
        const buffer = this.buffers[0];
        return {
            vertexArrayobject: buffer.srcVertexArrayObject,
            transformFeedback: buffer.transformFeedback,
        }
    }

    constructor({gpu, attributes, transformFeedbackVaryings, vertexShader, fragmentShader, uniforms}) {
        super();

        this.shader = new Shader({gpu, vertexShader, fragmentShader, transformFeedbackVaryings});
        this.uniforms = uniforms;

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
        
        const transformFeedback1 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject1.getBuffers()
        });
        const transformFeedback2 = new TransformFeedback({
            gpu,
            buffers: vertexArrayObject2.getBuffers()
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
