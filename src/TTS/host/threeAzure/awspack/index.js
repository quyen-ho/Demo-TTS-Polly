// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import TextToSpeechUtils from "../../core/awspack/TextToSpeechUtils";
import TextToSpeechFeature from "./TextToSpeechFeature";
import Speech from "./Speech";

/**
 * @module threeAzure/awspack
 */

const aws = {
  /**
   * @see three.js/TextToSpeechFeature
   */
  TextToSpeechFeature,
  /**
   * @see core/TextToSpeechUtils
   */
  TextToSpeechUtils,
  /**
   * @see three.js/Speech
   */
  Speech,
};

export default aws;
