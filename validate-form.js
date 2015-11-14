(function (global, $) {
	'use strict';
	//Types of input fields
	var _fieldTypes = {
		HIDDEN : 'hidden',
	   	TEXT : 'text',
	   	PASSWORD : 'password',
	   	CHECKBOX : 'checkbox',
	   	RADIO : 'radio',
	   	NUMBER : 'number',
	   	EMAIL : 'email',
		RANGE : 'range'
	};
	/*
	*	Field describes a field in a form. A name is required. By default, dataType is String
	*/
	var Field = function(name, datatype) {
		//Should be lenient with datatype
		if (arguments.length < 1) {
			throw 'You must specify a name';
		}
		datatype = datatype || Field.dataType.STRING;
		return new Field.init(name, datatype);
	};

	//Supported data types
	Field.dataType = {
		NUMBER : 'number',
		STRING :'string',
		DATE : 'date',
		BOOLEAN : 'boolean'
	};
	
	Field.isField = function(obj){
		return obj.hasOwnProperty("_fieldId");
	}
	/*
	*	Given an object, this function creates a new Field object. for example:
	*	var fPassword = {
			name:'password',
			regexp: /[A-Z]{4,8}/,
			isRequired:true
		}
	*/
	Field.newInstance = function(obj){
		var newField = new Field(obj.name, obj.dataType);
		for(var prop in obj){
			if(typeof newField[prop] === 'function'){
				switch(prop){
					case 'regexp':
						newField[prop](obj.regexp);
						break;
					case 'min':
						newField[prop](obj.min);
						break;
					case 'max':
						newField[prop](obj.max);
					break;
					case 'isRequired':
						newField[prop](obj.emptyValue);
						break;
					case 'interval':
						newField[prop](obj.interval.min, obj.interval.max);
						break;
					case 'intervalField':
						newField[prop](obj.interval.min.name, obj.interval.max.name);
					case 'pattern':
						newField[prop](obj.pattern);
						break;
					break;
				}
			
			}
		}
		return newField;
	}
	
	Field.prototype = {
		dataType : function(dataType) {
			validateDataType(dataType);
			return this;
		},
		validateDataType : function(dataType) {
			if(typeof dataType !== 'undefined') {
				for(var i in Field.dataType) {
					if(Field.dataType[i] === dataType){
						return true;
					}
				}
				var errMsg = 'Not valid dataType';
				$logger.error(errMsg)
				throw errMsg;
			}
		},
		min : function(minValue) {
			if(typeof minValue === 'undefined'){
				throw 'minValue is not given';
			}
			this.constraints.min = {value: minValue};
			return this;
		},
		max : function(maxValue) {
			if(typeof maxValue === 'undefined'){
				throw 'maxValue is not given';
			}
			this.constraints.max = {value: maxValue};
			return this;
		},
		eq : function(value) {
			if(typeof value === 'undefined'){
				throw 'A value for eq is not given';
			}
			this.constraints.eq = {value: value};
			return this;
		},
		//Adds a validation which consists on passing a regular expression
		pattern : function(regExp){
			if(!regExp){
				throw 'Specify regular expression';
			}
			if(regExp === 'string'){
				regExp = new RegExp(regExp);
			}
			if(!regExp instanceof RegExp){
				throw 'regExp is not a RegExp object'
			}
			this.constraints.pattern = {value : regExp};
			return this;
		},
		//emptyvalue represents a value that musn't match if it's required. By default, it's an empty string
		isRequired : function(emptyValue){
			emptyValue = emptyValue || '';
			this.constraints.isRequired = {emptyValue : emptyValue};
			//this.$node.parent().append('<span>*<span>');
			return this;
		},
		length : function(minlength, maxlength){
			var min = parseInt(minlength);
			var max = parseInt(maxlength);
			var validMin = !isNaN(min);
			var validMax = !isNaN(max);
			if(!validMin && !validMax){
				throw "Could not find values for minimum or a maximum for length";
			}else{
				this.constraints.length = {};
				if(validMin){
					this.constraints.length.min = min;
				}
				if(validMax){
					this.constraints.length.max = max;
				}
			}
			return this;
		},
		//To create an interval with constant values
		interval : function (_min, _max) {
			checkInterval(_min, _max);
			this.constraints.interval = {min: _min, max: _max};
			return this;
		},
		intervalField : function (fieldCmpMin, fieldCmpMax) {
			checkIntervalFields(fieldCmpMin, fieldCmpMax);
			this.constraints.intervalField = {min: fieldCmpMin, max: fieldCmpMax};
			return this;
		},
		disable : function(){
			this.$node.attr('disabled', true);
			return this;
		},
		enable : function(){
			this.$node.removeAttr('disabled');
			return this;
		},
		getValue : function(){
			return Utils.getValue(this.$node);
		},
		setValue : function(value){
			//TODO:Check if value is typeof dataType
			this.$node.val(value);
		},
		validate : function(){
			var node = this.$node;
			$logger.info('Checking field: ' + node.attr('name'));
			if(node.attr(IGNORE_FIELD) !== 'S'){
				var value = this.getValue();
				var status = this.status;
				$logger.log('Value of ' + this.name +  ' is ' + value);
				this.typeValError = validator.execute(this);
				this.status.valid =  !this.typeValError ? true : false;
			}
		},
		validateOn : function(eventType) {
			if(!eventType){
				throw 'eventType must be defined';
			}
			var field = this;
			field.$node.on(eventType, function(){
				field.validate();
				showValMsgField(field);
				highlightField(field);
			});
			return this;
		},
		//Disable the validation event
		offValidate : function(eventType){
			if(!eventType){
				throw 'eventType must be defined';
			}
			var field = this;
			field.$node.off(eventType);
			return this;
		},
		//Defines a callback which will be invoked when ignore method is called.
		onIgnore : function(fn){
			if(!fn || typeof fn !== 'function'){
				throw 'You must specify a handler for onIgnore';
			}
			this.events.onIgnore = fn;
			return this;
		},
		//Defines a callback which will be invoked when watch method is called.
		onWatch : function(fn){
			if(!fn || typeof fn !== 'function'){
				throw 'You must specify a handler for onWatch';
			}
			this.events.onWatch = fn;
			return this;
		}
	};
	
	
	/*
	*	Validators establishes the relation between the specified constraints for each field and the validator 	 
	*	that must be executed.
	*/
	var validator = {
        //Performs a validation which loops through the different constraints of a given field .
        //Returns the constraint in which the validation fails.
        execute : function(field){
            for(var cnstr in field.constraints){
                if(!this[cnstr](field, cnstr)){
                    return cnstr;
                };
            }
            return null;
        },
        min : function(field, constraint){
            var objCnstr = field.constraints[constraint];
            var minValue = objCnstr.value;
			var value = Utils.cast(field.getValue(), field.dataType);
			$logger.info('Comparing ' + value  + ' >= ' + minValue + ' = ' + 
						(value >= minValue));
			return value >= minValue;
		},
		max : function(field, constraint){
            var objCnstr = field.constraints[constraint];
            var maxValue = objCnstr.value;
			var value = Utils.cast(field.getValue(), field.dataType);
			value = Utils.cast(field.getValue(), field.dataType);
			$logger.info('Comparing ' + value  + ' <= ' + maxValue + ' = ' + (value <= maxValue));
			return value <= maxValue;
		},
		isRequired : function(field, constraint){
            var objCnstr = field.constraints[constraint];
            var emptyValue = objCnstr.emptyValue;
			return field.getValue() !== emptyValue;
		},
		interval : function(field, constraint){
            var objCnstr = field.constraints[constraint];
            var minValue = Utils.cast(objCnstr.min, field.dataType);
			var maxValue = Utils.cast(objCnstr.max, field.dataType);
            var value = Utils.cast(field.getValue(), field.dataType);
			return value >= minValue && value <= maxValue;
		},
        intervalField : function(fieldMin, fieldMax){
            var minValue = fieldMin.getValue(),
				maxValue = fieldMax.getValue();
            return minValue <= maxValue;
        },
		length : function(field, constraint){
			var length = field.getValue().length;
			var minLength = field.constraints.length.min? field.constraints.length.min : -1;
			var maxLength = field.constraints.length.max? field.constraints.length.max : -1;
			if(minLength === -1 && maxLength === -1){
				throw 'Invalid values for length constraint'
			}
			if(minLength && !maxLength){
				return length >= minLength;
			}else if(!minLength && maxLength){
				return length <= maxLength;
			}else{
				return length >= minLength && length <= maxLength;
			}
		},
		pattern : function(field, constraint){
			var regExp = field.constraints[constraint].value;
			var value = field.getValue();
			//The pattern validation will not take effect if value is empty
			return value.length === 0 ? true : regExp.test(value);
		}
	};
	
	//This is really where we create an instance of Field.
	Field.init = function(name, datatype){
		var self = this;
		self.validateDataType(datatype);
		self.name = name;
		self.dataType = datatype;
		//A very interesting trick to get a random sequence of letters and numbers
		self._fieldId = Math.random().toString(36).substr(2);
		//Stores or caches the node in order to prevent frequent queries to the same node
		self.$node = Utils.getNodeByName(self.name);
        //An object which stores whenever a validation rule for a specific field is included.
        self.constraints = {};
		self.status = {
			//Indicates that data is adequate according to the form field constraints
			valid : true
		}
        /*  It will tell us the reason why a field validation type. 
        *   It is mainly used for printing error messages in a form
        */
		self.typeValError = '';
		self.events = {};
	};
	
	/*
	*	The Form specifies a concrete form which holds from 1 to many fields.
	*	name: This is mandatory.The form in the html document must have set the name property.
    *   The constructor will look up the form according the name which is given to the first parameter.
	*	dictionary is an object which relates field names to translated ones according the specified language.
	*	For instance:
	*		{
	*			en:{
	*				'numDays' : 'Number of days',
	*				'startDate' : 'Start date'
	*			},
	*			es{
	*				'numDays' : 'Número de días',
	*				'startDate' : 'Fecha de inicio'
	*			}
	*		}
	*
	*/
	var Form = function(name, dictionary, lang) {
		if(arguments.length < 1) {
			throw "Form name is required";
		}
		if(!document.forms[name]) {
			throw 'Form named as ' + name + ' does not exist. Check if you forgot to put the attribute ' + 
				'name in the form or you misspelled the name parameter';
		}
		return new Form.init(name, dictionary, lang);
	};
	
	Form.Configuration = {
		status : {
			INIT : 'init',
			VALIDATING : 'validating',
			SUCCESS : 'success',
			ERROR : 'error'
		},
		style : {
			error : {
				field : {
					"border" : '1px red solid',
					"background" : '#FFDDDD'
				},
				textColor : {
					"color" : '#8b0808'
				}
			},
			success : {
				field : {
					"border" : '1px green solid',
					"background" : '#bbf6ab'
				},
				textColor : {
					"color" : '#286118'
				}
			}
		},
		setstyle : function(objErrStyle){
			this.style = objErrStyle;
		},
		//Use error styles 
		useStyle : true,
		dataTags:{
			IGNORE_FIELD : 'data-val-ign' 
		},
		//Default validation error messages in some languages like English and Spanish
		errMessages : {
			es : {
				isRequired : 'El campo #1# es obligatorio',
				min : 'El campo #1# debe ser mayor que #2#',
				interval: 'El valor para #1# debe estar entre #2# y #3#',
                intervalField : 'El valor de #1# no puede ser mayor #2#',
				length : {
					'min' : 'El campo #1# debe contener al menos #2# caracteres',
					'max' : 'El campo #1# debe contener como máximo #2# caracteres',
					'minMax' : 'El campo #1# debe contener entre #2# y #3# caracteres'
				},
				pattern : 'El valor introducido para #1# no cumple con #2#'
			},
			en : {
				isRequired : 'Field #1# is required',
				min : 'The value of the field #1# must be greater than #2#',
				interval : 'The value of #1# must be between #2# and #3#',
                intervalField : 'The value of #1# cannot be greater than #2#',
				length : {
					'min' : 'The field #1# must contain, at least, #2# characters',
					'max' : 'The field #1# must contain, at most, #2# characters',
					'minMax' : 'The field #1# must contain between #2# and #3# characters'
				},
				pattern : 'The value of #1# does not match #2#'
			}
		},
		language : {
			//English is the language used in every form by default
			default : 'en',
			//Stores the current language in the form
			current : 'en',
			set : function (lang){
				this.current = lang;
			}
		},
		//If you want to override some or all the default messages for validation errors, this gives you a chance to set your own messages
		setErrMessages : function (lang, messages){
			if(!lang){
				throw 'No language has been found';
			}
			if(!messages){
				throw 'No message has been found';
			}
			function replaceMessage(lang, messages){
				for(var m in messages){
					var obj = messages[m];
					if(typeof obj === 'string'){
						this.errMessages[lang][m] = messages[m];
					}else{
						replaceMessage(lang, obj);
					}
				}
			}
			replaceMessage.apply(this,[lang, messages]);
		},
		dateFormats :{
			default : 'dd/MM/yyyy',
			current : 'dd/MM/yyyy',
			patterns : {
				'dmy' : 'dd/MM/yyyy',
				'mdy' : 'MM/dd/yyyy',
				'ymd' : 'yyyy/MM/dd'
			},
			set : function(dateFormat){
				var notFound = true;
				for(var i in this.patterns){
					if(i === dateFormat){
						notFound = false;
						break;
					}
				}
				if(notfound){
					throw 'Expected "dmy", "mdy" or "ymd"';
				}else{
					this.current = this.patterns[dateFormat];
				}
				
			}
		},
		fieldNames : {}
	};
	
	//Shortcuts
	var IGNORE_FIELD = Form.Configuration.dataTags.IGNORE_FIELD;
	
	/*
	*	name : The name of the form.
	*	dictionary: object which contains all the necessary texts to display different messages in the form page
	*	lang: The prefered language you want to use in your form
	*/
	Form.init = function (name, dictionary, lang) {
		var self = this;
        self._formId = Math.random().toString(36).substr(2);
		self.name = name;
		self.fields = [];
		self.options = {
			highlightErrors : true,
			messageErrors : true,
		}
		if(!lang){
			lang = Form.Configuration.language.current;
		}
		if(dictionary){
			self.dictionary = dictionary[lang];
		}
        self.intervalFields = {};
        self.customValidations = [];
	}
    
    Form.isForm = function(obj){
		return obj.hasOwnProperty("_formId");
	}
    
     //Private functions
   function checkInterval(_min, _max){
        if(_min > _max){
                throw 'Invalid interval. Minimum value is greater than maximum';
            }
        if(!_min){
            throw 'Min is required for interval';
        }
        if(!_max){
            throw 'Max is required for interval';
        }
    };

    function checkIntervalFields(fieldCmpMin, fieldCmpMax){
        if(!fieldCmpMin){
            throw 'Field name for min is required for interval'
        }
        if(!fieldCmpMax){
            throw 'Field name for max is required for interval'
        }
    };
	
	function processFormOptions(){
		if(Form.Configuration.useStyle && this.options.highlightErrors){
			Map.forEach(this.fields,
				function(){
					highlightField(this);
				}
			);
		}
		if(this.options.messageErrors){
			Map.forEach(this.fields,
				function(form){
                    //If it's a non-ignored field
					showValMsgField(this);
				}, this); //End of field mapping

            showFormattedFormErrorText(this);
		}
	};
    
	function highlightField(field){
		if(!Field.isField(field)){
			throw 'Cannot highlight a non Field object'
		}
		if(field.$node.attr(IGNORE_FIELD)){
			return;
		}
		if(!field.status.valid){
			field.$node.css(Form.Configuration.style.error.field);
		}else{
			clearStyle(field);
		}
	}
	
	function showValMsgField(field){
		if(!field.$node.attr(IGNORE_FIELD)){
			var $msgNode = $('#msg-' + field.name);
			if($msgNode.length === 0){
				$logger.info(field.name + ' does not have #msg-');
				return;
			}
			if(!field.status.valid){
				var typeValError = field.typeValError;
				var currLang = Form.Configuration.language.current;
				var errMessages = Form.Configuration.errMessages[currLang];
				var errMsg = errMessages[typeValError] || '';
				var translatedName = form.dictionary.fields[field.name];
				//If no aliases are found then the name attribute field will be used by default.
				var aliasName = !form.dictionary || !translatedName? 
					field.name : translatedName;
				var formattedText = getFormattedFieldErrorText(field, errMsg, aliasName); 
				if(!formattedText){
					$logger.warn('No translation for field ' + field.name);
				}
				showValidationErrorMessage('#msg-' + field.name, formattedText);

			} else {
				clearStyle(field);
			}	
		}
	}
	
    function showValidationErrorMessage(selector, formattedText){
		var node = $(selector);
		node.text(formattedText)
		if(Form.Configuration.useStyle){
			node.css(Form.Configuration.style.error.textColor);
		}
    }
    
    function getFormattedFieldErrorText(obj, errMsg, aliasName){
		
		aliasName = aliasName || '';
        //obj must be a Field or Form
        if(Field.isField(obj)){
            if(obj.typeValError && errMsg){
                var cnstrByTypeValErr = obj.constraints[obj.typeValError];
                switch(obj.typeValError){
                    case 'min':
                    case 'max':
                        return Utils.format(errMsg, aliasName, cnstrByTypeValErr.value);
                    break;
                    case 'isRequired':
                        return Utils.format(errMsg, aliasName);
                    break;
                    case 'interval':
                        return Utils.format(errMsg, aliasName, cnstrByTypeValErr.min, cnstrByTypeValErr.max);
                    break;
                    case 'intervalField':
                        return Utils.format(errMsg, aliasName, cnstrByTypeValErr.min, cnstrByTypeValErr.max);
                    break;
					case 'length':
						//errMsg is not a string n this case.
						var msg;
						if(cnstrByTypeValErr.min && cnstrByTypeValErr.max){
							msg = errMsg.minMax;
						}
						else if(cnstrByTypeValErr.max){
							msg = errMsg.max;
						}
						else if(cnstrByTypeValErr.min){
							msg = errMsg.min;
						}
						return Utils.format(msg, aliasName, cnstrByTypeValErr.min, cnstrByTypeValErr.max);
					break;
					case 'pattern':
						return Utils.format(errMsg, aliasName, cnstrByTypeValErr.value);
						break;
					default:
						$logger.error(obj.typeValError + ' not registered to format text')
						break;
                }
                
            }
        }else {
            $logger.error('getFormattedFieldErrorText - object is not a Field')
        }
    }
    
	function showFormattedFormErrorText(form, errMsg, aliasName){
        if(Form.isForm(form)){
            for(var prop in form.intervalFields){
                if(typeof form.intervalFields[prop] === "object"){
                    var $msgNode = $('#msg-' + prop);
                    var currLang = Form.Configuration.language.current;
                    var errMessages = Form.Configuration.errMessages[currLang];
                    var errMsg = errMessages['intervalField'];
                    var intervalObj = form.intervalFields[prop];
                    var fieldMin = intervalObj.min;
                    var fieldMax = intervalObj.max;
					var fieldMinName = getTranslatedField(form.dictionary, fieldMin.name);
					var fieldMaxName = getTranslatedField(form.dictionary, fieldMax.name);
                    var formattedFormText = Utils.format(errMsg, fieldMinName, fieldMaxName);
                    showValidationErrorMessage('#msg-' + prop, formattedFormText);
                }
            }
        }
    }
	
	 //If this is not the first time we hit the the validation, reset the field styles.
	function clearStyle(obj){
		if(Field.isField(obj)){
			var field = obj;
			field.$node.css("border", "").css("background", "").css("color", "");
			$('#msg-' + field.name).text('');
		}
		if(Form.isForm(obj)){
			var form = obj;
			Map.forEach(form.fields, function(){
				this.$node.css("border", "").css("background", "").css("color", "");
			});
			//Replace validation messages
			$('.errorMessage').text('');
		}
	}
	
	function getTranslatedField(dictionary, property){
		if(!dictionary){
			return property;
		}
		if(!form.dictionary.fields[property]){
			$logger.warn('No translation for field: ' + property);
		}
		var found = form.dictionary.fields[property] || property;
		return found;
	}

    //Prototype for Form
	Form.prototype = {
		setDataType : function(dataType){
			this.dataType = dataType;
			return this;
		},
		addField : function (field){
			//field can be an instance of Field or an object which contains the configuration for a particular field.
			if(!field){
				throw 'field is missing';
			}
			if(!Field.isField(field)){
				this.fields.push(Field.newInstance(field));
			}else{
				this.fields.push(field);
			}
			return this;
		},
		//This method sets an interval constraint between two fields name that must be registered in the form object. 
        //Otherwise an exception will be thrown
		addInterval : function (intervalName, fieldMinName, fieldMaxName){
			if(!intervalName){
				throw 'intervalName for addInterval is needed';
			}
			if(!fieldMinName || !fieldMaxName){
				throw 'addInterval requires two fields';
			}
            var minField = this.getField(fieldMinName);
            var maxField = this.getField(fieldMaxName);
            
			if(!minField || !maxField){
				throw fieldMinName + ' and ' + fieldMaxName + ' must be registered in the form object'; 
			}
			this.intervalFields[intervalName] = {min : minField, max : maxField};
            return this;
		},
		//Performs the required validations as set in the Fields array.
		validate : function (valOptions) {
            
			clearStyle(this);
			//Check all the registered fields.
			Map.forEach(this.fields, 
				function () {
					//'this' refers to a field object of the array in the first parameter
					this.validate();
				}
			);
			//Check whether intervals are valid 

            for(var i in this.intervalFields){
                var fieldMin = this.intervalFields[i].min;
                var fieldMax = this.intervalFields[i].max;
                if(fieldMin.dataType !== fieldMax.dataType){
                    throw 'The fields, which define an interval, have different data type';
                }
                //TO FIX
                var success = validator.intervalField(fieldMin, fieldMax);
                if(!success){
                    //fieldMin.typeValError =  fieldMax.typeValError = 'intervalField';
                    this.intervalFields.error = true;
                    break;
                }
            }
            
            //is there any custom validation?
            if(!this.customValidations.isEmpty()){
                Map.forEach(this.customValidations,
                    function(form){
                        //Take out the custom validation function. 
                        //Remember that the function holds extra properties due to the fact that
                        //a function is an object as well.
                        var customValidation = this;
                        var args = [];
                        var idCstVal;
                        //Let's check the  ['_param' + i] properties that the function may hold 
                        for(var params in customValidation){
                            if(params.match(/_param\d{1,2}/)){
                                args.push(customValidation[params]);
                            }else if(params.indexOf('__') == 0){
                                idCstVal = params.replace('__', '');
                            }
                        }
                        var success = customValidation.apply(this, args);
                        if(!success && idCstVal){
                            var errMsg = form.dictionary.messages[idCstVal].error;
                            errMsg = Utils.format(errMsg, args);
                            showValidationErrorMessage('#msg-' + idCstVal, errMsg);
                        }
                    }, 
					this);
            }
            
            //Highlight and show errors in the form
			processFormOptions.apply(this);
			
			var success = Map.every(this.fields, 
				function () {
					//'this' refers to an element of the array in the first parameter
					return this.status.valid === true;
				}
			);
			
			if(!success && typeof valOptions.onError === "function"){
				valOptions.onError();
			}
			if(success && typeof valOptions.onSuccess === "function"){
				valOptions.onSuccess();
			}
			return this;
		},
		//Retrieves a validation field from a form instance in case you need to change some property of such field validation rule on the fly later.
		getField : function (name){
			if(Utils.isNullOrEmpty(name)) {
				return null;
			}
			var field = Map.filter(this.fields, 
				function (name) {
					//'this' refers to an element of the array in the first parameter
					return name[0] === this.name;
				}, [name]);
			//If a field is found, returns the element. Otherwise, it returns nothing
			return !field.isEmpty()? field[0] : null; 
		},
        setDictionary : function (dictionary, lang){
            self.dictionary = dictionary[lang]
            return this;
        },
		//If you definitely do not need to validate this field anymore you can invoke this method.
		removeField : function(name) {
			var field = this.getField(name);
			var index = this.fields.indexOf(field);
			$logger.log('Remove - Field ' + name + ' found at ' + this.fields.indexOf(field));
			this.fields.splice(index, 1);
			return this;
		},
		//It lets us to ignore temporarily a field for validation purposes
		ignoreField : function(name, params) {
			for(var  i = 0 ; i < this.fields.length ; i++){
				var field = this.fields[i];
				if(field.name === name){
					field.$node.attr(IGNORE_FIELD, 'S');
					if(typeof field.events.onIgnore === 'function'){
						field.events.onIgnore.apply(field, params);
					}
				}
			}
            return this;
		},
		//The opposite task of ignoreField.
		watchField : function(name, params) {
            Map.forEach(this.fields, function(){
                var field = this;
				if(field.name === name){
					field.$node.removeAttr(IGNORE_FIELD);
					if(typeof field.events.onWatch === 'function'){
						field.events.onWatch.apply(field, params);
					}
				}
            });
            return this;
		},
        /*
        *   Adds a custom validation in case you need to set more complex validation rules.
        *   customValidationConfig is an object which holds two properties: name and msg. The last one is 
        *   also an object which stores different messages depending on the state (error, success, etc) 
        *   although it's optional
        *   
        *   TO sum up, the estructure of customValidationConfig must be something like:
        *   {
        *       name: String        //mandatory
        *       msg: {
        *           error: String,
                    sucsess: String
        *       }
        *   }
        */
        addCustomValidation : function(name, customValFunction){
            if(!name){
                throw 'A name for the custom validation is required'
            }
            if(!customValFunction){
                throw 'Function not found for custom validations'
            }
            //As functions are also objects, we take advantage of this feature.
            for(var i = 2 ; i < arguments.length ; i++){
                customValFunction['_param' + i] = arguments[i];
            }
            //If there's an HTML node whose id is msg-[customValidationName], then an error message will be displayed
            customValFunction['__' + name] = this.dictionary.messages[name].error;
            
            this.customValidations.push(customValFunction); 
            return this;
        }
	};
	
	var Logger = {
		enabled: true,
		log : function(msg){
			if(console && this.enabled){
				console.log(msg);
			}
		},
		error : function(msg){
			if(console && this.enabled){
				console.error(msg);
			}
		},
		info : function(msg){
			if(console && this.enabled){
				console.info(msg);
			}
		},
		warn : function(msg){
			if(console && this.enabled){
				console.warn(msg);
			}
		}
	};
	
	Form.init.prototype = Form.prototype;
	Field.init.prototype = Field.prototype;
		
	global.$frm = global.$Form = Form; 
	
	global.$fld = global.$Field = Field;
	
	global.$logger = Logger;
	
	/*Module that provides some utilities functions to perform some auxiliary tasks*/
	var Utils = (function(){
        //Regular expression for placeholders in messages
		var PLACEHOLDER_PATTERN = /#\d{1,2}#/g;
		//$node is a jQuery object
		var _getNodeByName = function(name){
			var $node = $('[name=' + name + ']');
			return $node;
		}
		var _getValue = function($node) {

			var type = $node.attr("type");
			var value;
			var tagName = $node.prop("tagName").toUpperCase();
			if(tagName === "SELECT"){
				if($node.prop("multiple")){
					value = $node.filter(":selected")
						.map(function () {return this.value;})
						.get()
						.join(",");
				}
				else{
					value = $node.val();
				}
			}else if(tagName === "TEXTAREA"){
				value = $node.val();
			}else{
				switch (type){
					case _fieldTypes.CHECKBOX:
					case _fieldTypes.RADIO:
						value = $node
							.filter(":checked")
							.map(function () {return this.value;})
							.get()
							.join(",");
					break;
					case _fieldTypes.TEXT:
					case _fieldTypes.PASSWORD:
					case _fieldTypes.HIDDEN:
					case _fieldTypes.EMAIL:
					case _fieldTypes.NUMBER:
						value = $node.val();
					break;
				}
			}
			return value;
		};
		
		var _isNullOrEmpty = function(val) {
			return typeof val === 'undefined' || $.trim(val) === '';
		};
	
		//Converts data
		var _cast = function(value, dataType) {
			switch(dataType){
				case Field.dataType.NUMBER:
					return value * 1;
				break;
				case Field.dataType.DATE:
					var dateFormat = Form.Configuration.dateFormats.current;
					return Utils.toDate(value, dateFormat);
				break;
			}
		};
		
        /*
        *   The parameters after msg can be a list of params o another one which must be an array, 
        *   so we could invoke this function as follows:
                _format(msg, 1, 2, 3, 4);
                or
                _format(msg, [1, 2, 3, 4]);
                
        *   It converts a message like 'Enter value for #1#' to 'Enter value for amount'. 
        *   In other words, it replaces the placeholders whose pattern is #[Number]# 
        *   for the values which are given by the args parameter array.
        */
		var _format = function(msg){
			if(!msg){
				throw 'Message to format not found'
            }
            var replacements = {};
            // Object.prototype.toString.call( someVar )
            if(arguments.length === 2 && $.isArray(arguments[1])){
                var arrParams = arguments[1];
                for(var i = 0 ; i < arrParams.length ; i++){
                    replacements['#' + (i+1) + '#'] = arrParams[i];
                }
            }else{
                for(var i = 1 ; i < arguments.length ; i++){
                    replacements['#' + i + '#'] = arguments[i];
                }
            }
            var formatted = msg.replace(PLACEHOLDER_PATTERN, function(match){
                /*  We must cast any value to String. If the original value is an integer and is 0 
                *   then it will return false so the placeholder won't be replaced
                */
				if(typeof replacements[match] === 'undefined'){
					$logger.warn('replacements for ' + match + ' was not found');
					replacements[match] = '';
				}
                return replacements[match].toString() || match;
            });
            return formatted;
			
		};
		var _toDate = function(value, dateFormat){
			var tokensFormat = dateFormat.split('/');
			var tokensValue = value.split('/');
			var date = new Date();
			for(var i = 0 ; i < tokensFormat.length ; i++){
				switch (tokensFormat[i]){
					case 'dd':
						date.setDate(parseInt(tokensValue[i]));
						break;
					case 'MM':
						date.setMonth(parseInt(tokensValue[i]) - 1);
						break;
					case 'yyyy':
						date.setFullYear(parseInt(tokensValue[i]));
						break;
				}
			}
			return date;
		};
		
		return {
			getNodeByName : _getNodeByName,
			getValue : _getValue,
			cast : _cast,
			isNullOrEmpty: _isNullOrEmpty,
			format : _format,
			toDate : _toDate
		};
	})();
	
	/*Module which will be used to process an array in a function which may hold some parameters*/ 
	var Map = (function (){
		/*
		*	All these functions have the following parameters.
		*	array : the array which will be iterated.
		*	fn : a function to execute
		*	params : arguments for the function. A single string can be passed or in case 
		* 			you require to pass more parameters, then you must use an Array
		*/
		var _filter = function (array, fn, params){
			params = _checkParamsMapper(params);
			var elements = [];
			for(var i = 0 , j = array.length; i < j ; i++){
				var success = fn.apply(array[i], params);
				if(success){
					elements.push(array[i]);
				}
			}
			return elements;
		}
		
		var _every = function (array, fn, params){
			params = _checkParamsMapper(params);
			var success = true;
			for(var i = 0 , j = array.length; i < j && success; i++){
				success = fn.apply(array[i], params);
				if(!success){
					break;
				}
			}
			return success;	
		}
		
		var _forEach = function(array, fn, params){
			params = _checkParamsMapper(params);
			for(var i = 0 , j = array.length; i < j ; i++){
				fn.apply(array[i], params);
			}
		}
		
		function _checkParamsMapper(args){
			
			if(typeof args === 'undefined'){
				return [];
			}
			//Is it a String?
			/*if(typeof args === Field.dataType.STRING){
				return [args];
			}*/
			if(args.length > 3){
				throw 'Passing more than 1 parameter requires an array';
			}
			
			return  [args];
		}
		return {
			filter: _filter,
			every : _every,
			forEach : _forEach
		}
	})();

	if(!Array.prototype.isEmpty) {
		Array.prototype.isEmpty = function() {
			return this.length === 0;
		}
	}
}(window, jQuery));