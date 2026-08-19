package uk.co.stefirby.seriestracker.model;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SeriesValidator implements ConstraintValidator<ValidSeries, SeriesEntity> {
    @Override
    public boolean isValid(SeriesEntity series, ConstraintValidatorContext context) {
        if (series == null) return true;
        if (series.getTotalSeasons() != null && series.getCurrentSeason() != null) {
            if (series.getCurrentSeason() > series.getTotalSeasons()) {
                return false;
            }
        }
        return true;
    }
}