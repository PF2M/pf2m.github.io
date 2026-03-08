var dat = "";
async function Entry(inp, type) {
    Upload($("#mii-id").val(), "id");
}
async function Upload(inp, type) {
    let formData = new FormData();
    if (type == "mii") {
        var data = inp.files[0];
    }

    var src = "loading.gif";
    $(".mii").attr("src", src);
    $(".mii").attr("width", $(".parameter[name=width]").siblings(".small").text().split("px")[0]);

    if ($("[name=version]").val() == "1.0.0" || $("[name=version]").val() == "2.0.0") {
        return;
    } else {
        formData.append("platform", $("[name=version]").val());
    }

    if (type == "mii") {
        formData.append("data", data);
    } else {
        formData.append("id", inp);
    }

    var mii = "";
    var miistudio = "";

    try {
        let r = await fetch("https://qrcode.rc24.xyz/cgi-bin/studio.cgi", { method: "POST", body: formData })
            .then((response) => response.json())
            .then((data) => {
                mii = data.mii;
                miistudio = data.miistudio;
                name = data.name;
                creator_name = data.creator_name;
                birthday = data.birthday;
                favorite_color = data.favorite_color;
                height = data.height;
                build = data.build;
                gender = data.gender;
                mingle = data.mingle;
                copying = data.copying;
            });
    } catch (e) {
        console.log("Error when fetching", e);
    }
    dat = mii;
    change(mii);
    $(".miistudio").val(miistudio);
    $(".name").text(name);
    $(".creator_name").text(creator_name);
    if (birthday != "00/00") {
        $(".birthday").text(birthday);
    }
    $(".favorite_color").text(favorite_color);
    $(".height").text(height);
    $(".build").text(build);
    $(".gender").text(gender);
    $(".mingle").text(mingle);
    $(".copying").text(copying);
}
function decimalToHex(d) {
    var hex = Number(d).toString(16).toUpperCase();
    if (hex.length == 1) hex = "0" + hex;
    return hex;
}
$(document).ready(function () {
    $("input[type=range]").on("change", function () {
        if ($(this)[0].hasAttribute("list")) {
            var selected = $("datalist#" + $(this).attr("list")).children("option[value=" + $(this).val() + "]");
            if (selected[0].hasAttribute("label")) {
                $(this).siblings(".small").text(selected.attr("label"));
            } else {
                $(this).siblings(".small").text($(this).val());
            }
        } else {
            $(this).siblings(".small").text($(this).val());
        }
    });
    $(".lightbox").on("change", function () {
        if ($(this).prop("checked")) {
            $(".light").removeAttr("disabled");
        } else {
            $(".light").attr("disabled", "true");
        }
    });
    $("input, select").on("change", function () {
        if (dat != "") {
            change(dat);
        } else {
            change("");
        }
    });
});

function change(mii) {
    $(".mii").attr("width", $(".parameter[name=width]").siblings(".small").text().split("px")[0]);
    $(".parameter[name=width]").val($(".parameter[name=width]").siblings(".small").text().split("px")[0]);
    $(".parameter[name=bgColor]").val($(".parameter[name=bgColor]").siblings("[name=bgColor]").val().split("#")[1].toUpperCase() + decimalToHex($("[name=bgColorOpacity]").val()));
    if ($("[name=version]").val() == "1.0.0" || $("[name=version]").val() == "2.0.0") {
        var src =
            "https://cdn-mii.accounts.nintendo.com/" +
            $("[name=version]").val() +
            "/miis/" +
            $("[name=id]").val() +
            "/image/68747470733a2f2f-7066326d2e636f6d." +
            $("[name=format]").val() +
            "?" +
            $(".parameter:not(:disabled)").serialize();
        $(".mii").attr("src", src);
    } else if (mii != "") {
        var src = "https://studio.mii.nintendo.com/miis/image.png?data=" + mii + "&" + $(".parameter:not(:disabled)").serialize();
        $(".mii").attr("src", src);
    }
}
