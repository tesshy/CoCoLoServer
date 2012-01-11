
function allcheck(targetForm,flag){
	for(n=0;n<=targetForm.length-1;n++){
		if(targetForm.elements[n].type == "checkbox"){
			targetForm.elements[n].checked = flag;}}
};

function postTo(item){
	var postData = {}
	postData["_id"] = $(item).siblings('label[name="_id"]').text();
	postData["_rev"] = $(item).siblings('label[name="_rev"]').text();
	postData[item.name] = item.value;

	console.log(postData);
	$.ajax({url: './editor',
			type: 'POST',
			data: postData,
			dataType : "json",
		    error: function(){alert('Error Occured');},
			success: function(data, dataType){
				console.log("RES_rev:" + data.rev);
				$(item).siblings('label[name="_rev"]').text(data.rev);
			}
		   });
	return false;
};

function addColumn(item){
	var pForm = $(item).closest('form');
	$('<label>', {text:$(item).val()}).appendTo(pForm);
	$('<input>', {type:'text', 
				  name:$(item).val(), 
				  size:100,
				  onchange:'postTo(this)'}).appendTo(pForm);

	$(item).remove();	
	$('<br>').appendTo(pForm);
	$('<input>',{type:'text', 
				 name:'addKey', 
				 onClick:'addColumn(this)', 
				 size:'10'}).appendTo(pForm);
};
