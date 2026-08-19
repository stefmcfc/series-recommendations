package uk.co.stefirby.seriestracker.model;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SeriesValidator.class)
@Documented
public @interface ValidSeries {
    String message() default "Invalid series data";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}