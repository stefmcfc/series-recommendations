package uk.co.stefirby.seriestracker.model;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SeriesValidator implements ConstraintValidator<ValidSeries, SeriesEntity> {
    @Override
    public boolean isValid(SeriesEntity series, ConstraintValidatorContext context) {
        if (series == null) return true;
        return series.getTotalSeasons() == null || series.getCurrentSeason() == null
                || series.getCurrentSeason() <= series.getTotalSeasons();
    }
}