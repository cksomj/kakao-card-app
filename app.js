const KAKAO_JAVASCRIPT_KEY = "7039d10f9dcfd467890f3c81b5ffacbf";
const FIXED_SITE_NAME = "jw.org";
const CONTAIN_POSITION_Y = 0.5;
const BUTTON_FINGER = "\u261D\uFE0E";

const fields = {
  imageUrl: document.querySelector("#imageUrl"),
  targetUrl: document.querySelector("#targetUrl"),
  titleText: document.querySelector("#titleText"),
  descriptionText: document.querySelector("#descriptionText"),
  buttonText: document.querySelector("#buttonText"),
  imageFit: document.querySelectorAll("input[name='imageFit']")
};

const preview = {
  imageStage: document.querySelector("#previewImageStage"),
  image: document.querySelector("#previewImage"),
  title: document.querySelector("#previewTitle"),
  description: document.querySelector("#previewDescription"),
  button: document.querySelector("#previewButton"),
  site: document.querySelector("#previewSite")
};

const statusText = document.querySelector("#sendStatus");
const targetHint = document.querySelector("#targetHint");
const savedImageFit = localStorage.getItem("kakaoCardApp.imageFit");

if (savedImageFit) {
  const fitControl = document.querySelector(`input[name='imageFit'][value='${savedImageFit}']`);
  if (fitControl) fitControl.checked = true;
}

statusText.textContent = location.protocol === "file:" ? "파일로 열면 카카오 전송이 막힙니다. http://localhost:5188 로 접속해 주세요." : "";

function fallback(value, text) {
  return value.trim() || text;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function updatePreview() {
  const imageUrl = fallback(fields.imageUrl.value, fields.imageUrl.defaultValue);
  const targetUrl = fallback(fields.targetUrl.value, "https://www.jw.org/");
  const title = fallback(fields.titleText.value, "성경 질문과 대답");
  const description = fallback(fields.descriptionText.value, "어떻게 이 땅에 평화가 이루어질 것입니까?");
  const button = getButtonLabel();

  preview.image.src = imageUrl;
  preview.title.textContent = title;
  preview.description.textContent = description;
  preview.button.textContent = button;
  preview.button.href = isHttpUrl(targetUrl) ? targetUrl : "#";
  preview.site.textContent = FIXED_SITE_NAME;
  preview.image.dataset.fit = getImageFit();
  preview.imageStage.dataset.fit = getImageFit();
  preview.imageStage.style.backgroundImage = getImageFit() === "contain" ? `url("${imageUrl.replace(/"/g, "%22")}")` : "";
  preview.image.style.objectPosition = getImageFit() === "contain" ? `center ${CONTAIN_POSITION_Y * 100}%` : "center center";
  targetHint.textContent = getTargetDomainHint(targetUrl);
}

Object.entries(fields).forEach(([name, field]) => {
  if (name === "imageFit") return;
  field.addEventListener("input", updatePreview);
});

fields.imageFit.forEach((field) => {
  field.addEventListener("change", () => {
    localStorage.setItem("kakaoCardApp.imageFit", getImageFit());
    updatePreview();
  });
});

document.querySelector("#sendToMe").addEventListener("click", async () => {
  try {
    await sendKakaoMessageToMe();
    statusText.textContent = "내 카톡 나와의 채팅방으로 전송했습니다.";
  } catch (error) {
    console.error(error);
    statusText.textContent = formatKakaoError(error);
  }
});

document.querySelector("#shareKakao").addEventListener("click", () => {
  try {
    shareKakaoMessage();
    statusText.textContent = "카톡 공유창을 열었습니다.";
  } catch (error) {
    console.error(error);
    statusText.textContent = formatKakaoError(error);
  }
});

preview.image.addEventListener("error", () => {
  preview.image.removeAttribute("src");
  preview.image.style.background = "linear-gradient(135deg, #dce6ef, #f7fafc)";
});

updatePreview();

function getImageFit() {
  return document.querySelector("input[name='imageFit']:checked")?.value || "contain";
}

function getTargetDomainHint(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return `카카오 제품 링크 관리에 등록할 도메인: ${url.origin}`;
  } catch {
    return "http 또는 https로 시작하는 화면 접속 링크를 입력해 주세요.";
  }
}

function getTargetUrl() {
  const targetUrl = fallback(fields.targetUrl.value, "https://www.jw.org/");
  if (!isHttpUrl(targetUrl)) {
    throw new Error("화면 접속 링크는 http 또는 https 주소여야 합니다.");
  }
  const url = new URL(targetUrl);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    throw new Error("버튼 링크가 로컬 앱 주소입니다. 화면 접속 링크를 실제로 열 웹사이트 주소로 바꿔 주세요.");
  }
  return url.href;
}

function getKakaoLink(targetUrl) {
  return {
    web_url: targetUrl,
    mobile_web_url: targetUrl
  };
}

function getButtonLabel() {
  const text = fallback(fields.buttonText.value, "버튼을 눌러 자세히 알아보세요").replace(/\s*☝︎?\s*$/, "");
  return `${text} ${BUTTON_FINGER}`;
}

function formatKakaoError(error) {
  if (!error) return "전송하지 못했습니다.";
  if (typeof error === "string") return error;
  if (error.error_description) return error.error_description;
  if (error.error) return `${error.error}${error.error_description ? `: ${error.error_description}` : ""}`;
  if (error.message) return error.message;
  if (error.msg) {
    const scopeHint = error.code === -402 ? " 동의항목 talk_message 설정이나 추가 동의가 필요합니다." : "";
    const domainHint = error.code === -401 || error.code === -403 ? " JavaScript SDK 도메인과 제품 링크 Web 도메인을 확인해 주세요." : "";
    return `${error.msg}${error.code ? ` (${error.code})` : ""}${scopeHint}${domainHint}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "전송하지 못했습니다.";
  }
}

function ensureKakaoReady() {
  if (location.protocol === "file:") {
    throw new Error("파일로 연 화면에서는 카카오 전송이 어렵습니다. http://localhost:5188 로 접속해 주세요.");
  }
  if (!window.Kakao) {
    throw new Error("카카오 SDK를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  }
  if (!Kakao.isInitialized()) {
    Kakao.init(KAKAO_JAVASCRIPT_KEY);
  }
}

async function getMessageTemplate(options = {}) {
  const imageUrl = options.useOriginalImage ? fallback(fields.imageUrl.value, fields.imageUrl.defaultValue) : await getSendImageUrl();
  const targetUrl = getTargetUrl();
  const title = fallback(fields.titleText.value, "성경 질문과 대답");
  const description = fallback(fields.descriptionText.value, "어떻게 이 땅에 평화가 이루어질 것입니까?");
  const button = getButtonLabel();
  const link = getKakaoLink(targetUrl);

  return {
    object_type: "feed",
    content: {
      title,
      description,
      image_url: imageUrl,
      image_width: 800,
      image_height: 800,
      link
    },
    item_content: {
      profile_text: FIXED_SITE_NAME
    },
    buttons: [
      {
        title: button,
        link
      }
    ],
    button_title: button
  };
}

function shareKakaoMessage() {
  ensureKakaoReady();
  const templateObject = getShareTemplateSync();

  if (Kakao.Share && typeof Kakao.Share.sendDefault === "function") {
    Kakao.Share.sendDefault(templateObject);
    return;
  }

  if (Kakao.Link && typeof Kakao.Link.sendDefault === "function") {
    Kakao.Link.sendDefault(templateObject);
    return;
  }

  throw new Error("카카오 공유 기능을 사용할 수 없습니다. 페이지를 새로고침해 주세요.");
}

function getShareTemplateSync() {
  const imageUrl = fallback(fields.imageUrl.value, fields.imageUrl.defaultValue);
  const targetUrl = getTargetUrl();
  const title = fallback(fields.titleText.value, "성경 질문과 대답");
  const description = fallback(fields.descriptionText.value, "어떻게 이 땅에 평화가 이루어질 것입니까?");
  const button = getButtonLabel();
  const link = {
    webUrl: targetUrl,
    mobileWebUrl: targetUrl
  };

  return {
    objectType: "feed",
    content: {
      title,
      description,
      imageUrl,
      link
    },
    buttons: [
      {
        title: button,
        link
      }
    ],
    buttonTitle: button
  };
}

async function getSendImageUrl() {
  const imageUrl = fallback(fields.imageUrl.value, fields.imageUrl.defaultValue);
  if (getImageFit() !== "contain") return imageUrl;

  try {
    statusText.textContent = "삽화를 전체 보이기용 정사각형 이미지로 변환하고 있습니다.";
    const file = await createContainedImageFile(imageUrl);

    if (!Kakao.Share || typeof Kakao.Share.uploadImage !== "function") {
      throw new Error("카카오 이미지 업로드 기능을 사용할 수 없습니다.");
    }

    const response = await Kakao.Share.uploadImage({
      file: makeUploadFileList(file)
    });
    const uploadedUrl = response?.infos?.original?.url;
    if (!uploadedUrl) {
      throw new Error("카카오 이미지 업로드 응답에서 이미지 URL을 찾지 못했습니다.");
    }
    return uploadedUrl;
  } catch (error) {
    console.error("전체 보이기 이미지 변환 실패", error);
    throw new Error(`전체 보이기 이미지를 만들지 못했습니다: ${formatKakaoError(error)}`);
  }
}

function makeUploadFileList(file) {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    return dataTransfer.files;
  } catch {
    return [file];
  }
}

async function createContainedImageFile(imageUrl) {
  const image = await loadImageForCanvas(imageUrl);
  const canvas = document.createElement("canvas");
  const size = 800;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  drawCoverBackground(context, image, size);

  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) * CONTAIN_POSITION_Y);
  context.drawImage(image, x, y, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
  if (!blob) {
    throw new Error("삽화를 변환하지 못했습니다.");
  }

  return new File([blob], "kakao-card-image.jpg", { type: "image/jpeg" });
}

function drawCoverBackground(context, image, size) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.ceil(image.naturalWidth * scale);
  const height = Math.ceil(image.naturalHeight * scale);
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);

  context.save();
  context.filter = "blur(42px)";
  context.drawImage(image, x - 70, y - 70, width + 140, height + 140);
  context.restore();

  context.fillStyle = "rgba(255, 255, 255, 0.52)";
  context.fillRect(0, 0, size, size);
}

function loadImageForCanvas(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("삽화 이미지를 불러오지 못했습니다. 다른 이미지 링크를 사용해 주세요."));
    image.src = imageUrl;
  });
}

async function requestTalkMessageScope() {
  const token = Kakao.Auth.getAccessToken();
  if (token) return;

  await new Promise((resolve, reject) => {
    const popupTimer = window.setTimeout(() => {
      statusText.textContent = "로그인 창이 보이지 않으면 팝업이 차단된 것입니다. 외부 Chrome/Edge에서 열어 보세요.";
    }, 1500);

    Kakao.Auth.login({
      scope: "talk_message",
      success: (response) => {
        window.clearTimeout(popupTimer);
        resolve(response);
      },
      fail: (error) => {
        window.clearTimeout(popupTimer);
        reject(error);
      }
    });
  });
}

async function sendKakaoMessageToMe() {
  statusText.textContent = "카카오 로그인과 전송을 준비하고 있습니다.";
  ensureKakaoReady();
  const targetUrl = getTargetUrl();
  statusText.textContent = `전송할 버튼 링크: ${targetUrl}`;
  await requestTalkMessageScope();
  const templateObject = await getMessageTemplate();

  await new Promise((resolve, reject) => {
    Kakao.API.request({
      url: "/v2/api/talk/memo/default/send",
      data: {
        template_object: templateObject
      },
      success: resolve,
      fail: reject
    });
  });
}
