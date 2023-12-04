import {GLObject} from "./GLObject.js";

export class TransformFeedback extends GLObject {
    #transformFeedback;
    #gpu

    get glObject() {
        return this.#transformFeedback;
    }

    constructor({gpu, buffers}) {
        super();

        this.#gpu = gpu;

        const gl = this.#gpu.gl;

        this.#transformFeedback = gl.createTransformFeedback();
        gl.bindTransformFeedback(this.#transformFeedback, this.glObject);

        for (let i = 0; i < buffers.length; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffers[i]);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }

        gl.bindTransformFeedback(this.#transformFeedback, null);
    }
}
