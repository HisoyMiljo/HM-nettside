const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const page = document.body.dataset.page;

document.querySelectorAll("[data-page-link]").forEach((link) => {
  if (link.dataset.pageLink === page) {
    link.setAttribute("aria-current", "page");
  }
});

const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window && revealItems.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const contactForm = document.querySelector("#contact-form");

if (contactForm) {
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const statusMessage = contactForm.querySelector("[data-form-status]");

  const setStatus = (message, type) => {
    if (!statusMessage) {
      return;
    }

    statusMessage.hidden = false;
    statusMessage.textContent = message;
    statusMessage.classList.remove("is-error", "is-success");
    statusMessage.classList.add(type === "error" ? "is-error" : "is-success");
  };

  const clearStatus = () => {
    if (!statusMessage) {
      return;
    }

    statusMessage.hidden = true;
    statusMessage.textContent = "";
    statusMessage.classList.remove("is-error", "is-success");
  };

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sender...";
    }

    try {
      const formData = new FormData(contactForm);
      const body = new URLSearchParams();

      for (const [key, value] of formData.entries()) {
        body.append(key, value.toString());
      }

      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`Submission failed with status ${response.status}`);
      }

      const successUrl =
        contactForm.dataset.successUrl || contactForm.getAttribute("action") || "./";
      window.location.href = successUrl;
    } catch (error) {
      setStatus(
        "Skjemaet kunne ikke sendes akkurat nå. Prøv igjen, eller kontakt oss direkte på sbo@hmiljo.no / +47 922 10 245.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send melding";
      }
    }
  });
}
