# Omitted Variable Lab — a DGP to experiment with
# Open in RStudio and click Source, or run: Rscript ovb_dgp.R
# Uses base R only; no packages to install.
# This is the website's probability model. R uses a different random-number
# generator, so the same seed does not reproduce the website's exact sample.

# 1. Change these settings, then run the file again.
n <- 500
rho <- 0.85                  # Population correlation of study and sleep
sleep_coefficient <- 3       # Score points per extra hour of sleep
study_coefficient <- 5       # Score points per extra hour of study
intercept <- 20
noise_sd <- 3.5
seed <- 42

# Try rho <- 0, rho <- -0.85, or sleep_coefficient <- 0.
# Keep abs(rho) < 1 so the full regression is not perfectly collinear.
stopifnot(n > 3, n == as.integer(n), abs(rho) < 1, noise_sd > 0)
set.seed(seed)

# 2. Draw independent ingredients and construct study, sleep, and scores.
# A and B each have mean 0 and variance 1.
A <- runif(n, min = -sqrt(3), max = sqrt(3))
B <- runif(n, min = -sqrt(3), max = sqrt(3))
noise <- rnorm(n, mean = 0, sd = noise_sd)

study <- 4 + sqrt(3) * A     # Uniform between 1 and 7 hours
sleep <- 7 + 0.75 * (rho * A + sqrt(1 - rho^2) * B)
score <- intercept + study_coefficient * study + sleep_coefficient * sleep + noise
students <- data.frame(study, sleep, score, noise)

# 3. Estimate the full model and a short model that omits sleep.
full_model <- lm(score ~ study + sleep, data = students)
short_model <- lm(score ~ study, data = students)
cat("\nFULL MODEL: score ~ study + sleep\n")
print(summary(full_model))
cat("\nSHORT MODEL: score ~ study\n")
print(summary(short_model))

# An error uses the true DGP; a residual uses estimated coefficients.
students$full_error <- noise
students$full_fitted <- fitted(full_model)
students$full_residual <- residuals(full_model)
students$short_fitted <- fitted(short_model)
students$short_residual <- residuals(short_model)
students$omitted_error <- sleep_coefficient * sleep + noise
students$recentered_error <- sleep_coefficient * (sleep - 7) + noise

# 4. Population bias: omitted-variable effect x sleep-on-study slope.
bias <- sleep_coefficient * rho * 0.75 / sqrt(3)
cat(sprintf("\nTrue study effect: %.3f\nPopulation bias: %.3f\n", study_coefficient, bias))
cat(sprintf("Population short-model study slope: %.3f\n", study_coefficient + bias))
cat(sprintf("Sample short-model study slope: %.3f\n", coef(short_model)["study"]))
cat("Zero population bias does not eliminate sampling variation.\n")

# 5. Plot the study-only regression and the recentered structural error.
# score = (intercept + 7 * sleep_coefficient) + study_coefficient * study
#         + recentered_error
# E[recentered_error | study] = bias * (study - 4).
# The second plot uses the structural error, not fitted OLS residuals.
plot_lab <- function() {
  old_par <- par(mfrow = c(1, 2))
  on.exit(par(old_par))
  plot(study, score, pch = 16, col = "#3458D455",
       xlab = "Study hours", ylab = "Score", main = "Study-only regression")
  abline(short_model, col = "#2265C5", lwd = 2)
  plot(study, students$recentered_error, pch = 16, col = "#3458D455",
       xlab = "Study hours", ylab = "Recentered error", main = "Sleep contribution + noise")
  abline(h = 0, col = "gray60", lty = 2)
  abline(a = -4 * bias, b = bias, col = "#168354", lwd = 2)
  legend("topleft", "Expected error given study", col = "#168354", lwd = 2, bty = "n")
}

# In RStudio, plots appear in the Plots pane. Rscript saves a PDF instead.
if (interactive()) {
  plot_lab()
} else {
  pdf("ovb_plots.pdf", width = 10, height = 4.5)
  plot_lab()
  dev.off()
}

# Save the simulated students in the current working directory.
write.csv(students, "ovb_students.csv", row.names = FALSE)
cat("\nSaved ovb_students.csv in: ", getwd(), "\n", sep = "")
