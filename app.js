var form;

$(function () {
	'use strict';
	var dictionary = {
		en : {
			fields : {
				'numDays' : 'Number of days',
				'startDate' : 'Start date',
				'country' : 'Country',
				'extras' : 'One way / Return'
			},
			messages : {
				customValNumDays : {
					error : 'Number of days must be greater than #1#'
				}
			}
		},
		es : {
			fields : {
				'numDays' : 'Número de días',
				'startDate' : 'Fecha de inicio',
				'country' : 'País',
				'extras' : 'Ida / Vuelta'
			},
			messages : {
				customValNumDays : {
					error : 'El número de días ha de ser mayor que #1#'
				}
			}
		}
	};
	
	$Form.Configuration.language.set('es');
	
	$Form.Configuration.setErrMessages('es', 
		{pattern : 'El valor de #1# no cumple con los requisitos'}
	);
	
	//var numDays = $Field('numDays', $Field.dataType.NUMBER).min(0);
	form = $Form("searcher", dictionary)
		.addField($Field('numDays', $Field.dataType.NUMBER).min(0))
		.addField($Field('startDate', $Field.dataType.DATE).interval('01/01/2015', '31/12/2015'))
		.addField($Field('endDate', $Field.dataType.DATE))
        .addInterval('startEnd', 'startDate', 'endDate')
		.addField(
			$Field('comment', $Field.dataType.STRING)
			.length(10, 50)
			.validateOn('keyup')
		);
	
	var fCountry = $Field('country', $Field.dataType.STRING).isRequired('-1');
	form.addField(fCountry);
	
	
	var fPassword = $Field.newInstance({
		name : 'password',
		pattern : /[A-Z]{4,8}/,
		isRequired : true
	}).onIgnore(function (){
		this.disable();
	}).onWatch(function (){
		this.enable();
	});
	
	form.addField(fPassword);
	
	form.addField($Field('extras', $Field.dataType.STRING).isRequired());
	
	form.ignoreField('password');
	//var numDays = form.getField("numDays");
	
	//form.removeField('country');
	//console.log(numDays);
	
	console.log(form);
	
	$("#checkIt").on('click', function (){
		form.validate({
			onSuccess : function(){
				console.log("Everything went fine!");
			},
			onError : function(){
				console.error("Whoops! You need to recheck the form")
			}
		});
	});
	
	$("#watchPassword").on('click', function (){
		form.watchField('password');
	});
	
    form.addCustomValidation(
       'customValNumDays',
        function (numDays) {
            return $('[name=numDays]').val() > numDays;
        },
		100);
	
	$("#rating").on('input change', function(){
		$("#ratingVisor").val($(this).val());
	});
	/*
	var dateFormat = 'MM/dd/yyyy';
	var value = '04/02/2015'; 
	
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
	console.log(date.toString());				
	
	var dt = new Date(2014, 6, 12);
	console.log(dt.getMilliseconds() );
	*/
	
});
