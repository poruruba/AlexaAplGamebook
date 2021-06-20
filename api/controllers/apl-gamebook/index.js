'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';

const AskUtils = require(HELPER_BASE + 'alexa-utils');
const Alexa = require('ask-sdk-core');
const app = new AskUtils(Alexa);

const gamebookDocumentBase = require('./gamebookDocumentBase.json');
const gamebookVideoDocumentBase = require('./gamebookVideoDocumentBase.json');
const scenario = require('./scenario.json');
const styleResource = require('./styleResource.json');
const HELLO_WORLD_TOKEN = 'helloworldToken';
const CHOICE_INTENT	= 'choice';
const PARAMETER_KEY = "gamebookStyles";
const SCENE_START = "0";

app.intent("ChoiceSelectIntent", async (handlerInput) => {
	console.log(handlerInput);
	var builder = handlerInput.responseBuilder;

	var slots = app.getSlots(handlerInput);
	var select = parseInt(slots.select.value);

	var attributes = app.getAttributes(handlerInput);
	var choice_id = findChoiceId(scenario, attributes.current_id, select - 1);
	attributes.current_id = choice_id;
	app.setAttributes(handlerInput, attributes);

	var scene = scenario.scenes.find(item => item.id == choice_id);
	appendSceneDocument(handlerInput, builder, scene);

	return builder.getResponse();
});

app.intent("ChoiceNextIntent", async (handlerInput) => {
	console.log(handlerInput);
	var builder = handlerInput.responseBuilder;

	var select = 1;

	var attributes = app.getAttributes(handlerInput);
	var choice_id = findChoiceId(scenario, attributes.current_id, select - 1);
	attributes.current_id = choice_id;
	app.setAttributes(handlerInput, attributes);

	var scene = scenario.scenes.find(item => item.id == choice_id);
	appendSceneDocument(handlerInput, builder, scene);

	return builder.getResponse();
});

app.intent('LaunchRequest', async (handlerInput) => {
	console.log(handlerInput);

	var builder = handlerInput.responseBuilder;
	builder.speak('始める、と言ってください。');
	builder.reprompt('始める、と言ってください。');
	return builder.getResponse();
});

app.intent('StopIntent', async (handlerInput) => {
	console.log(handlerInput);

	var builder = handlerInput.responseBuilder;
	builder.speak('さようなら');
	builder.withShouldEndSession(true);
	return builder.getResponse();
});

app.intent('GameStartIntent', async (handlerInput) => {
	var builder = handlerInput.responseBuilder;

	var choice_id = SCENE_START;

	var attributes = app.getAttributes(handlerInput);
	attributes.current_id = choice_id;
	app.setAttributes(handlerInput, attributes);

	var scene = scenario.scenes.find(item => item.id == choice_id);
	appendSceneDocument(handlerInput, builder, scene);

	return builder.getResponse();
});

app.userEvent(undefined, async (handlerInput) => {
	var builder = handlerInput.responseBuilder;

	var request = app.getUserEventRequest(handlerInput);
	var choice_id = request.arguments[0].choice_id;

	var attributes = app.getAttributes(handlerInput);
	attributes.current_id = choice_id;
	app.setAttributes(handlerInput, attributes);

	var scene = scenario.scenes.find(item => item.id == choice_id);
	appendSceneDocument(handlerInput, builder, scene);

	return builder.getResponse();
});

app.userEvent(CHOICE_INTENT, async (handlerInput) => {
	var builder = handlerInput.responseBuilder;

	var request = app.getUserEventRequest(handlerInput);
	var choice_id = request.arguments[0].choice_id;

	var attributes = app.getAttributes(handlerInput);
	attributes.current_id = choice_id;
	app.setAttributes(handlerInput, attributes);

	var scene = scenario.scenes.find(item => item.id == choice_id);
	appendSceneDocument(handlerInput, builder, scene);

	return builder.getResponse();
});

exports.handler = app.lambda();


function appendSceneDocument(handlerInput, builder, scene) {
	if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
		var gamebookbase = makeDocument(scene, PARAMETER_KEY);
		builder.addDirective(app.buildRenderDocumentDirective(HELLO_WORLD_TOKEN, gamebookbase, styleResource));
		if (scene.type != 'video') {
			var sentence = makeSentence(scene);
			builder.speak(sentence);
			builder.reprompt('次と言ってください');
		}
	} else {
		var sentence = makeSentence(scene);
		builder.speak(sentence);
		builder.reprompt('番号を言ってください');
	}
}

function findChoiceId(scenario, current_id, select) {
	var scene = scenario.scenes.find(item => item.id == current_id);
	if (!scene)
		return null;

	if( scene.type == 'video')
		return scene.choice_id;
		
	var choice = scene.choices.choices[select];
	if (!choice)
		return null;

	return choice.choice_id;
}

function makeDocument(scene, param_key) {
	if (!scene)
		return null;

	if (scene.type == 'normal') {
		var gamebookbase = JSON.parse(JSON.stringify(gamebookDocumentBase));

		setParameterKey(gamebookbase, param_key);
		setBackgroundImage(gamebookbase, scene.backgroundImage);
		setTitle(gamebookbase, scene.title);
		setHeaderTitle(gamebookbase, scene.headerTitle);
		if (scene.players && scene.players.length > 0) {
			for (var i = 0; i < scene.players.length; i++)
				pushPlayer(gamebookbase, scene.players[i].image_src, scene.players[i].height, scene.players[i].position);
		}
		if (scene.sentences && scene.sentences.length > 0) {
			appendSentencePage(gamebookbase);
			for (var i = 0; i < scene.sentences.length; i++)
				appendText(gamebookbase, scene.sentences[i]);
		}

		if (scene.choices) {
			appendChoicePage(gamebookbase, scene.choices.text);
			for (var i = 0; i < scene.choices.choices.length; i++)
				appendChoice(gamebookbase, CHOICE_INTENT, scene.choices.choices[i].text, { choice_id: scene.choices.choices[i].choice_id });
		}
		console.log(JSON.stringify(gamebookbase));

		return gamebookbase;
	} else if (scene.type == "video") {
		var gamebookbase = JSON.parse(JSON.stringify(gamebookVideoDocumentBase));

		setParameterKey(gamebookbase, param_key);
		setVideoTitle(gamebookbase, scene.title);
		setVideo(gamebookbase, CHOICE_INTENT, scene.video_src, { choice_id: scene.choice_id });
		console.log(JSON.stringify(gamebookbase));

		return gamebookbase;
	}
}

function makeSentence(scene) {
	if (!scene)
		return null;

	if (scene.type == 'normal') {
		var sentence = '';

		if (scene.sentences && scene.sentences.length > 0) {
			for (var i = 0; i < scene.sentences.length; i++)
				sentence += scene.sentences[i] + '。';
		}

		if (scene.choices) {
			sentence += scene.choices.text + '。';
			for (var i = 0; i < scene.choices.choices.length; i++)
				sentence += String(i + 1) + '、' + scene.choices.choices[i].text + '。';
		}
		console.log(sentence);

		return sentence;
	} else if (scene.type == "video") {
		var sentence = '';

		if (scene.sentences && scene.sentences.length > 0) {
			for (var i = 0; i < scene.sentences.length; i++)
				sentence += scene.sentences[i] + '。';
		}

		return sentence;
	}
}

function getPlayerItems(document) {
	return document.mainTemplate.items[0].items[2].items;
}

function getContentItems(document) {
	return document.mainTemplate.items[0].items[3].items;
}

function getPagerItems(document) {
	var content = getContentItems(document);
	return content[1].item[0].items;

}

function getSentencePage(document) {
	var pager = getPagerItems(document);
	var page = pager[0];
	if (page == null || page.type != 'Sequence')
		return null;
	else
		return page;
}

function getChoicePage(document) {
	var pager = getPagerItems(document);
	var page = pager[pager.length - 1];
	if (page == null || page.type != 'Container')
		return null;
	else
		return page;
}

function setParameterKey(document, param_key){
	document.mainTemplate.parameters.push(param_key);
}

function setBackgroundImage(document, image){
	document.mainTemplate.items[0].items[0].backgroundImageSource = image;
}

function setHeaderTitle(document, title) {
	document.mainTemplate.items[0].items[1].text = title;
}

function setTitle(document, title) {
	var content = getContentItems(document);
	content[0].text = title;
}

function pushPlayer(document, image, height, position){
	var pos = Math.floor((position - 6) * (50 / 6));
	var obj = {
		"type": "Image",
		"height": height + "%",
		"width": "100%",
		"scale": "best-fit",
		"source": image,
		"position": "absolute",
		"align": "bottom",
		"left": pos + "%"
	};
	var items = getPlayerItems(document);
	items.push(obj);
}

function appendText(document, text){
	var page = getSentencePage(document);
	if( page == null )
		return;

	var index = page.items.length;
	var obj = {
		"type": "Text",
		"id": "para_" + index,
		"text": text,
		"speech": text,
		"color": "${gamebookStyles.gb_font_color}",
		"paddingBottom": "${gamebookStyles.gb_para_padding}",
		"fontSize": "${gamebookStyles.gb_font_size}"
	};
	page.items.push(obj);
}

function appendSentencePage(document) {
	var obj = {
		"type": "Sequence",
		"padding": "${gamebookStyles.gb_padding}",
		"items": [
		]
	};
	var content = getContentItems(document);
	content[1].item[0].items.push(obj);
}

function appendChoicePage(document, text){
	var obj = {
		"type": "Container",
		"padding": "${gamebookStyles.gb_padding}",
		"items": [
			{
				"type": "Text",
				"id": "para_choice",
				"text": text,
				"speech": text,
				"color": "${gamebookStyles.gb_font_color}",
				"paddingBottom": "${gamebookStyles.gb_para_padding}",
				"fontSize": "${gamebookStyles.gb_font_size}"
			}
		]
	};
	var content = getContentItems(document);
	content[1].item[0].items.push(obj);
}

function appendChoice(document, id, text, argument){
	const number_text = [ '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨' ];

	var page = getChoicePage(document);
	if( page == null )
		return;

	var index = page.items.length - 1;
	var obj = {
		"type": "TouchWrapper",
		"id": id,
		"item": {
			"type": "Text",
			"text": number_text[index] + " " + text,
			"speech": String(index + 1) + "、" + text,
			"color": "${gamebookStyles.gb_font_color}",
			"fontSize": "${gamebookStyles.gb_font_size}"
		},
		"onPress": [
			{
				"type": "SendEvent",
				"arguments": [
					argument
				]
			}
		]
	};
	page.items.push(obj);
}

function setVideo(document, intent, video, argument){
	document.mainTemplate.items[0].items[0].id = intent;
	document.mainTemplate.items[0].items[0].source = video;
	document.mainTemplate.items[0].items[0].onEnd[0].arguments.push(argument);
}

function setVideoTitle(document, title) {
	document.mainTemplate.items[0].items[1].text = title;
}
