import {GLObject} from "./GLObject.js";

export class TransformFeedback extends GLObject {
    #transformFeedback;
    #gpu
    buffers;

    get glObject() {
        return this.#transformFeedback;
    }

    constructor({gpu, buffers}) {
        super();

        this.#gpu = gpu;

        const gl = this.#gpu.gl;

        this.buffers = buffers;

        this.#transformFeedback = gl.createTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.glObject);

        for (let i = 0; i < buffers.length; i++) {
            const {buffer} = buffers[i];
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffer);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    }
}
